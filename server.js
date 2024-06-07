const http = require('http');
const Koa = require('koa');
const { koaBody } = require('koa-body');
const WS = require('ws');
const Router = require('koa-router');

const app = new Koa();
const router = new Router();

let usersList = ["Вадим", "Вика"];

app.use(koaBody({ urlencoded: true }));

app.use(async (ctx, next) => {
  const origin = ctx.request.get('Origin');
  if (!origin) return next();

  ctx.response.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
    'Access-Control-Allow-Headers': ctx.request.get('Access-Control-Request-Headers') || '',
  });

  if (ctx.request.method === 'OPTIONS') {
    ctx.response.status = 204;
    return;
  }

  return next();
});

router.post('/users', async (ctx) => {
  const { name } = ctx.request.body;
  console.log(`Received POST request for user: ${name}`);

  if (usersList.includes(name)) {
    ctx.response.status = 400;
    console.log("name exists");
    return;
  }

  usersList.push(name);
  ctx.response.body = { status: "OK" };

  broadcastUsersList(); // Send updated usersList to all clients
});

app.use(router.routes());

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback());

const wss = new WS.Server({ port: 3000 });

function broadcastUsersList() {
  const usersListJson = JSON.stringify({ users: usersList });

  wss.clients.forEach((client) => {
    if (client.readyState === WS.OPEN) {
      console.log("Sent:", usersListJson);
      client.send(usersListJson);
    }
  });
}

wss.on('connection', (ws) => {
  broadcastUsersList(); // Send initial usersList to new client
  ws.clientName = null;

  ws.on('message', (data) => {
    try {
      const receivedData = JSON.parse(data);
      console.log('Received message from client:', receivedData);

      if (receivedData.name) {
        ws.clientName = receivedData.name;
      }

      const jsonData = JSON.stringify({
        name: ws.clientName,
        message: receivedData.message,
      });

      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WS.OPEN) {
          client.send(jsonData);
        }
      });
    } catch (error) {
      console.error('Error parsing JSON data:', error);
    }
  });

  ws.on('close', () => {
    if (ws.clientName) {
      const index = usersList.indexOf(ws.clientName);
      if (index !== -1) {
        usersList.splice(index, 1);
        console.log(`Removed ${ws.clientName} from usersList`);
        broadcastUsersList(); // Send updated usersList to all clients
      }
    }
  });
});

server.listen(port);
console.log('server listening on port:', port);