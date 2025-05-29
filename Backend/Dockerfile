FROM node:22.14.0-alpine

RUN apk update && apk add --no-cache postgresql-client

WORKDIR /usr/src/app

COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY . .

COPY entrypoint.sh /usr/src/app/entrypoint.sh
RUN sed -i 's/\r$//' /usr/src/app/entrypoint.sh
RUN chmod +x /usr/src/app/entrypoint.sh


EXPOSE 3000

ENTRYPOINT ["/usr/src/app/entrypoint.sh"]
CMD ["npm", "start"]
