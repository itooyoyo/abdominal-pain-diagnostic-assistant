# 腹痛鑑別支援ツール

## Current status

Adaptive Differential Engine Prototype / not a clinical completion version

The browser-only prototype separates input normalization, clinical context,
differential evaluation, adaptive question selection, stop evaluation, and
presentation. It does not use external diagnostic APIs.

## Planned flow

1. 腹痛部位
2. Vital / 全身状態
3. 追加症候・診察所見
4. 鑑別候補

## Development

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

VercelではBuild Commandを`npm run build`、Output Directoryを`dist`としてデプロイできます。
