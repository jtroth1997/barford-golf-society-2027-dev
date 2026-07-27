# Barford Golf Society 2027 — Speed Optimised

Performance changes:
- intro video reduced from 2880×2880 to 1080×1080
- unused video audio removed
- MP4 metadata moved to the start for faster playback
- logo image reduced to a web-appropriate size
- homepage renders before intro playback begins
- intro plays no more than once every 24 hours
- six-second hard timeout prevents the intro blocking the site
- asynchronous image decoding
- below-the-fold rendering deferred where supported
- existing Members, Events and Scores functions retained

The development account and Scores data remain browser-only and do not connect to the live production site.
