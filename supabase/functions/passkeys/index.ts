import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "npm:@simplewebauthn/server@13";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const rpID = Deno.env.get("PASSKEY_RP_ID") || "jtroth1997.github.io";
const rpName = "Barford Golf Society";
const expectedOrigin = Deno.env.get("PASSKEY_ORIGIN") || "https://jtroth1997.github.io";
const headers = {
  "Access-Control-Allow-Origin": expectedOrigin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const bytesToB64 = (value: Uint8Array) => {
  let binary = "";
  value.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};
const b64ToBytes = (value: string) => {
  const normal = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normal.padEnd(Math.ceil(normal.length / 4) * 4, "="));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
};
const saveChallenge = async (challenge: string, userId: string, purpose: "register" | "login") => {
  await admin.from("passkey_challenges").delete().lt("expires_at", new Date().toISOString());
  const { error } = await admin.from("passkey_challenges").insert({
    challenge, user_id: userId, purpose, expires_at: new Date(Date.now() + 300_000).toISOString()
  });
  if (error) throw error;
};
const takeChallenge = async (challenge: string, userId: string, purpose: "register" | "login") => {
  const { data } = await admin.from("passkey_challenges").delete().eq("challenge", challenge)
    .eq("user_id", userId).eq("purpose", purpose).gt("expires_at", new Date().toISOString()).select().maybeSingle();
  if (!data) throw new Error("This request expired. Please try again.");
};
const authenticatedUser = async (request: Request) => {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Please sign in first.");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("Your session has expired. Please sign in again.");
  return data.user;
};
const findUser = async (email: string) => {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find(user => user.email?.toLowerCase() === email);
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const action = new URL(request.url).pathname.split("/").pop();
    const body = await request.json().catch(() => ({}));

    if (action === "register-options") {
      const user = await authenticatedUser(request);
      const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).single();
      const { data: credentials } = await admin.from("passkey_credentials").select("id,transports").eq("user_id", user.id);
      const options = await generateRegistrationOptions({
        rpName, rpID, userName: user.email!, userDisplayName: profile?.full_name || user.email!,
        userID: new TextEncoder().encode(user.id), attestationType: "none",
        authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
        excludeCredentials: (credentials || []).map(item => ({ id: item.id, transports: item.transports as AuthenticatorTransport[] }))
      });
      await saveChallenge(options.challenge, user.id, "register");
      return json(options);
    }

    if (action === "register-verify") {
      const user = await authenticatedUser(request);
      const verification = await verifyRegistrationResponse({
        response: body.credential,
        expectedChallenge: async challenge => { await takeChallenge(challenge, user.id, "register"); return true; },
        expectedOrigin, expectedRPID: rpID, requireUserVerification: true
      });
      if (!verification.verified || !verification.registrationInfo) throw new Error("The device could not be verified.");
      const info = verification.registrationInfo;
      const { error } = await admin.from("passkey_credentials").upsert({
        id: info.credential.id, user_id: user.id, public_key: bytesToB64(info.credential.publicKey),
        counter: info.credential.counter, transports: body.credential.response.transports || [],
        device_type: info.credentialDeviceType, backed_up: info.credentialBackedUp
      });
      if (error) throw error;
      return json({ verified: true });
    }

    if (action === "login-options") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) throw new Error("Enter your email address first.");
      const user = await findUser(email);
      if (!user) throw new Error("No device sign-in is set up for that account.");
      const { data: credentials } = await admin.from("passkey_credentials").select("id,transports").eq("user_id", user.id);
      if (!credentials?.length) throw new Error("No device sign-in is set up for that account.");
      const options = await generateAuthenticationOptions({
        rpID, userVerification: "required",
        allowCredentials: credentials.map(item => ({ id: item.id, transports: item.transports as AuthenticatorTransport[] }))
      });
      await saveChallenge(options.challenge, user.id, "login");
      return json(options);
    }

    if (action === "login-verify") {
      const email = String(body.email || "").trim().toLowerCase();
      const user = await findUser(email);
      if (!user) throw new Error("Device sign-in was not recognised.");
      const { data: stored } = await admin.from("passkey_credentials").select("*").eq("id", body.credential.id).eq("user_id", user.id).single();
      if (!stored) throw new Error("Device sign-in was not recognised.");
      const verification = await verifyAuthenticationResponse({
        response: body.credential,
        expectedChallenge: async challenge => { await takeChallenge(challenge, user.id, "login"); return true; },
        expectedOrigin, expectedRPID: rpID, requireUserVerification: true,
        credential: {
          id: stored.id, publicKey: b64ToBytes(stored.public_key), counter: Number(stored.counter),
          transports: stored.transports as AuthenticatorTransport[]
        }
      });
      if (!verification.verified) throw new Error("Device sign-in failed.");
      await admin.from("passkey_credentials").update({
        counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString()
      }).eq("id", stored.id);
      const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (error || !link.properties.hashed_token) throw error || new Error("Secure session could not be created.");
      return json({ tokenHash: link.properties.hashed_token });
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Device sign-in failed." }, 400);
  }
});
