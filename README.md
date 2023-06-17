# ApeCoin staking wallet stats

## Getting Started

1. Set `ALCHEMY_API_KEY` in your env. `e.g. export ALCHEMY_API_KEY={your key}`
2. `$ npm i`
3. `$ npm run start`


>NOTE: This project indexes all ApeCoin staking logs since it's deployment. It runs in 100 call concurrent batches, but can still take time to load and significant CPU/Memory. I recommend getting the "seed" data from 0xm1kr and placing it in the `output` folder, then setting the `START_BLOCK` in `index.js` to the latest indexed block so you do not need to reload all of the data.

## Seed Data

Last Run: 2023-06-17

Latest Block: 17498264

[Google Drive Folder](https://drive.google.com/drive/folders/1-qjNoZLCZl7q4MAeDrXBqG64ZSeHpafy?usp=drive_link)