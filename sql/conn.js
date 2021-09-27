const db = require('mysql')

const conn = db.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'deli_mydelivery'
});
 
conn.connect(function(err) {
    if (err) {
        console.error('Error:- ' + err.stack);
        return;
    }
    console.log('Connected Id:- ' + conn.threadId);
});

module.exports = conn;