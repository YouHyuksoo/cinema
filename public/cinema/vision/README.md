# Local face detector assets

Runtime: `@mediapipe/tasks-vision@1.0.1`, Apache-2.0. The IIFE bundle and SIMD/non-SIMD WASM loader pairs are copied unchanged from the installed npm package. `vision_bundle.js` exposes the `Vision` global to the classic worker. Do not substitute a module worker: the runtime loads its WASM support through `importScripts`.

Model: MediaPipe BlazeFace short range (float16), downloaded 2026-09-07 from:
https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite

SHA-256: `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f`

Official model documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector

These assets load from this application only when the user enables the camera. Camera frames stay in the browser and are transferred to a local Worker for bounding-box detection. No recordings, identity templates, uploads, or microphone input are created.

When updating the pinned npm dependency, refresh the matching runtime files together, then verify worker initialization and face detection in the browser. Retain the license alongside redistributed assets.
