(() => {
  "use strict";

  const removeTestOptions = () => {
    [
      "#adminQuickTestCard",
      "#quickTestEventDialog",
      "#testEventWarningDialog",
      "#adminDirectTestEvent"
    ].forEach(selector => document.querySelector(selector)?.remove());

    document.querySelectorAll("[data-quick-test-event],[data-start-test],[data-end-test],[data-reset-test]").forEach(element => element.remove());

    document.querySelectorAll("button,a").forEach(element => {
      const text = (element.textContent || "").trim().toLowerCase();
      if (["test event","start test event","end test","end test event","end active test","reset test"].includes(text)) {
        element.remove();
      }
    });

    document.querySelectorAll(".admin-test-live-note,.season-test-live,.quick-test-event,.test-start-button,.test-end-button").forEach(element => element.remove());
  };

  removeTestOptions();
  new MutationObserver(removeTestOptions).observe(document.documentElement, { childList: true, subtree: true });
})();
