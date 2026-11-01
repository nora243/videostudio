Video engine bundled from gemini-watermark-remover (MIT). See LICENSE.
Build: node scripts/build-postproduction.cjs <upstream checkout>
Bundled on 2026-10-28T11:18:02.031Z

Frame extraction/cleanup engine: frame-engine.js, built with node scripts/build-frame-engine.cjs from the same MIT upstream. Uses the video watermark detector (diamond and Veo text) and reverse alpha blending on the selected frame.
