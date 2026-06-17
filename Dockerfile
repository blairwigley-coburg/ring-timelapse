FROM node:22-alpine AS BUILD_IMAGE

WORKDIR /work

COPY . /work/

# install 
RUN npm install 

# build
RUN npm run build

# remove development dependencies
RUN npm prune --production

# attempt node-prune optimization (optional, won't fail if unavailable)
RUN curl -sf https://gobinaries.com/tj/node-prune | sh || true
RUN /usr/local/bin/node-prune || true

FROM node:22-alpine

# add ffmpeg
RUN apk add  --no-cache ffmpeg

ENV TOKEN=$TOKEN 
# ENV CRON_SCHEDULE="*/1 * * * *"
ENV CRON_SCHEDULE="*/15 * * * *"
ENV CRON_SCHEDULE_TIMELAPSE="0 7 * * *"

WORKDIR /app

# copy from build image
COPY --from=BUILD_IMAGE /work/dist ./dist
COPY --from=BUILD_IMAGE /work/node_modules ./node_modules
COPY --from=BUILD_IMAGE /work/package.json .

# Create the cron log (will be ensured again at runtime)
RUN touch /var/log/cron.log

# Setup our start file (it will create the crontab at container start using env vars)
COPY ./cron/run.sh /tmp/run.sh
RUN chmod +x /tmp/run.sh 

CMD ["/tmp/run.sh"]
