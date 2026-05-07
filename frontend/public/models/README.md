# Face-API Model Weights

Drop these JSON + shard files into this directory before running the
Face Check-In page. Download from:

  https://github.com/justadudewhohacks/face-api.js/tree/master/weights

Required files (about 6 MB total):

  tiny_face_detector_model-weights_manifest.json
  tiny_face_detector_model-shard1
  face_landmark_68_model-weights_manifest.json
  face_landmark_68_model-shard1
  face_recognition_model-weights_manifest.json
  face_recognition_model-shard1
  face_recognition_model-shard2

The hook `useFaceDetection` loads them from `/models/` on first scan.
