const express = require('express');
const { errorHandler } = require('./middlewares/errorHandler');
const { usersRouter } = require('./routes/users');
const { establishmentsRouter } = require('./routes/establishments');
const { reviewsRouter } = require('./routes/reviews');
const { syscoinRouter } = require('./routes/syscoin');
const { leaderboardRouter } = require('./routes/leaderboard');
const { authRouter } = require('./routes/auth');
const { authenticate } = require('./middlewares/auth');
const { swaggerSpec } = require('./config/swagger');
const { adminRouter } = require('./routes/admin');
const { healthRouter } = require('./routes/health');

const app = express();

app.use(express.json());

app.get('/openapi.json', (req, res) => {
  res.json(swaggerSpec);
});

app.get('/docs', (req, res) => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const specUrl = `${baseUrl}/openapi.json`;
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Syspoints API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '${specUrl}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout"
      });
    </script>
  </body>
</html>`);
});

app.get('/', (req, res) => {
  res.redirect('/docs');
});

app.use('/auth', authRouter);

app.use('/users', usersRouter);
app.use('/establishments', establishmentsRouter);
app.use('/reviews', reviewsRouter);
app.use('/syscoin', syscoinRouter);
app.use('/leaderboard', leaderboardRouter);
app.use('/admin', adminRouter);
app.use('/health', healthRouter);

app.use(errorHandler);

module.exports = app;
