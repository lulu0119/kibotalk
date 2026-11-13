# Third-party notices

## Icons

[Solar Icons](https://icon-sets.iconify.design/solar/) by 480 Design are licensed
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). KiboTalk adapts
the colors of the Line Duotone icons in its floating toolbar.

## Local speech models

KiboTalk downloads pinned speech assets from the upstream publishers when needed.
The macOS app includes [xsAI Apple Speech](https://github.com/moeru-ai/xsai-apple-speech),
licensed under MIT. Its license is included in the app's resources.

- [Silero VAD v5.1.2](https://github.com/snakers4/silero-vad/tree/v5.1.2) is licensed under MIT.
- [CAM++ Chinese/English advanced](https://huggingface.co/moeru-ai/sherpaw-campplus-zh-en-advanced) is published by the 3D-Speaker team and packaged by Sherpaw under Apache 2.0.
- [Multilingual streaming Zipformer](https://huggingface.co/moeru-ai/sherpa-onnx-streaming-zipformer-ar_en_id_ja_ru_th_vi_zh-2025-02-10) and [X-ASR INT8](https://huggingface.co/moeru-ai/sherpaw-x-asr-zh-en-480ms-int8) are distributed under Apache 2.0.
- [Pyannote segmentation 3.0 ONNX conversion](https://huggingface.co/csukuangfj/sherpa-onnx-pyannote-segmentation-3-0/tree/9403a6902bb58e3d5ae8c7e77c3422de279db2e0) is used for local media speaker diarization in Playground. See its [upstream license](https://huggingface.co/csukuangfj/sherpa-onnx-pyannote-segmentation-3-0/blob/9403a6902bb58e3d5ae8c7e77c3422de279db2e0/LICENSE).
- [Bilingual streaming Paraformer](https://huggingface.co/moeru-ai/sherpaw-paraformer-zh-en) is distributed as a Sherpaw preload pack.

## WeSpeaker ResNet34-LM in earlier builds

Earlier KiboTalk builds distributed a quantized ONNX conversion of
`Wespeaker/wespeaker-voxceleb-resnet34-LM` from
`onnx-community/wespeaker-voxceleb-resnet34-LM`.

- Production revision:
  `6a61a1833ff2583aabeba044f5c8221f00b67ceb`
- Original project: <https://github.com/wenet-e2e/wespeaker>
- Original model: <https://huggingface.co/Wespeaker/wespeaker-voxceleb-resnet34-LM>
- ONNX conversion: <https://huggingface.co/onnx-community/wespeaker-voxceleb-resnet34-LM>
- License: Creative Commons Attribution 4.0 International
  (<https://creativecommons.org/licenses/by/4.0/>)

The model was trained on VoxCeleb2 Dev. KiboTalk's local inference,
enrollment-quality checks, threshold calibration, and turn-decision pipeline
are modifications made by KiboTalk and are not endorsed by the model authors.

Please cite:

> Wang, Hongji, et al. “WeSpeaker: A Research and Production Oriented Speaker
> Embedding Learning Toolkit.” ICASSP 2023.

> Zeinali, Hossein, et al. “BUT System Description to VoxCeleb Speaker
> Recognition Challenge 2019.” arXiv:1910.12592, 2019.
