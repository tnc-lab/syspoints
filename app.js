const express = require('express');
const { errorHandler } = require('./middlewares/errorHandler');
const { usersRouter } = require('./routes/users');
const { establishmentsRouter } = require('./routes/establishments');
const { reviewsRouter } = require('./routes/reviews');
const { syscoinRouter } = require('./routes/syscoin');
const { leaderboardRouter } = require('./routes/leaderboard');
const { authRouter } = require('./routes/auth');
const { authenticate } = require('./middlewares/auth');
const swaggerUi = require('swagger-ui-express');
const { swaggerSpec } = require('./config/swagger');
const { adminRouter } = require('./routes/admin');
const { healthRouter } = require('./routes/health');

const app = express();

app.use(express.json());

app.get('/openapi.json', (req, res) => {
  res.json(swaggerSpec);
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(null, { swaggerUrl: '/openapi.json' }));

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
