# Vector Drift Site

Static landing page and beta download hub for `vectordrift.io`.

## GitHub Pages setup

1. Create a new GitHub repo, for example `vectordrift-site`.
2. Push this folder to the repo.
3. In GitHub, open **Settings > Pages**.
4. Set **Source** to **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`.
6. Confirm the custom domain is `vectordrift.io`.

## DNS

At your DNS provider, point the apex domain at GitHub Pages:

- `185.199.108.153`
- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`

Optional `www` record:

- `CNAME` -> `jonsimo.github.io`

## Beta links

Edit `beta/index.html` to replace the placeholder beta download URLs.
