const express = require('express');
var path = require('path');
const app = express();
const port = 3000;
const checkout = require('./routes/checkout');
const { json, urlencoded } = require('body-parser');

app.use(json());
app.use(urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/checkout', checkout);
app.get('/', (req, res) => { res.send(index.html) })
app.listen(port, () => { console.log(`App listening on port ${port}`) })

module.exports = app;