FROM node:22.22.2-alpine AS construction
ARG DOMAINE=localhost
WORKDIR /client
COPY client/package.json client/package-lock.json client/.npmrc ./
RUN npm ci
COPY client/ ./
RUN VITE_SERVEUR=https://${DOMAINE} npm run build

FROM caddy:2.10.2-alpine
COPY --from=construction /client/dist /srv
