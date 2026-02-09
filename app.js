const express = require('express');
const { errorHandler } = require('./middlewares/errorHandler');
const { usersRouter } = require('./routes/users');
const { establishmentsRouter } = require('./routes/establishments');
const { reviewsRouter } = require('./routes/reviews');
const { syscoinRouter } = require('./routes/syscoin');

const app = express();

app.use(express.json());

app.use('/users', usersRouter);
app.use('/establishments', establishmentsRouter);
app.use('/reviews', reviewsRouter);
app.use('/syscoin', syscoinRouter);

app.use(errorHandler);

module.exports = { app };
