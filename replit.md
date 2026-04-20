# PW Batch Manager

An Express.js web app to access PW (Physics Wallah) lecture batches, subjects, chapters, and videos.

## Architecture

- **Backend**: Node.js + Express.js (ES Modules)
- **Database**: MongoDB via Mongoose (requires `MONGODB_URL` secret)
- **Views**: EJS templating engine
- **Port**: 5000

## Environment Variables / Secrets

- `MONGODB_URL` — MongoDB connection string (required for saved batches feature)

## Key Routes

| Route | Description |
|---|---|
| `/` | Landing page |
| `/login` | Token-based login (PW API token) |
| `/batches` | List paid/free batches from PW API |
| `/batches/:slug/details` | Batch subjects |
| `/batches/:batch/subject/:sub/topics` | Chapter list |
| `/batches/:batch/subject/:sub/contents/:chapter` | Videos, notes, DPP |
| `/saved/Batches` | Saved batches from MongoDB |
| `/amit_khurana` | Amit Khurana CS lectures |
| `/hls` | HLS video proxy |
| `/play` | Video player page |

## Video Player Integration

Lectures open via the Heroku player:
```
https://anonymouspwplayerr-3cfbfedeb317.herokuapp.com/pw?url={videoUrl}&token={pw_token}
```

The PW token is passed from the server (stored in cookie) to the client via the EJS `videosBatch` view.

## 3D UI Theme

The frontend uses a custom 3D design system:

- **`public/stylesheets/3d-theme.css`** — global 3D theme (dark background, glassmorphism cards, gradient text)
- **`public/javascripts/3d-bg.js`** — animated particle/node network canvas background + 3D card tilt on hover

All main views use `#bg-canvas` for the animated background and `.card-3d` for tiltable glassmorphism cards.

## Starting the App

```bash
npm start
```

Listens on `0.0.0.0:5000`.
