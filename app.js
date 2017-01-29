/**
 * Required modules
 */
var express = require('express')
var path = require('path')
var mongoose = require('mongoose')
var moment = require('moment')
var passport = require('passport')
var Strategy = require('passport-local').Strategy
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn()

//connect to wedding database
mongoose.connect('mongodb://localhost/wedding');

/**
 *DB Collections
 */

var Guest = mongoose.model('Guest', {
    name: String,
    surname: String,
    email: String,
    invitation: {
        arrival_date: Date,
        departure_date: Date,
        hotel_id: Number,
        housing_budget: Number,
        spending_budget: Number,
    }
})

var User = mongoose.model('User',{
    username: String,
    password: String
})

//initialise express
var app = express()

/**
 * Passport auth settings
 */

passport.use(new Strategy(function(username, password, cb) {
    User.findOne({username: username}, function(err, user) {
        if (err) { res.send(err) }
        if (!user) { return cb(null, false) }
        if (user.password !== password) { return cb(null, false) }

        return cb(null, user)
    })
}))

passport.serializeUser(function(user, cb) {
    cb(null, user.id);
});

passport.deserializeUser(function(id, cb) {
    User.findById(id, function (err, user) {
        if (err) { return cb(err); }
        cb(null, user);
    });
});

app.use(require('cookie-parser')());
app.use(require('body-parser').json())
app.use(require('body-parser').urlencoded({extended : true}))
app.use(require('express-session')({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));

//make public folder accessible from client
app.use(express.static(path.join(__dirname, 'public')))

//initialise view engine
app.set('view engine', 'ejs')
app.set('./views', path.join(__dirname, 'views'))

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());

/**
 * Routes
 */

/*
    ADMIN ROUTES
 */
app.get('/admin/login', function(req, res) {
    res.render('admin/login', {})
})

app.post('/admin/login', passport.authenticate('local', { failureRedirect: '/admin/login' }), function(req, res) {
    res.redirect('/admin/guests')
})

app.get('/admin/logout', function(req, res){
    req.logout();
    res.redirect('/');
});

app.get('/admin', function(req, res){
    res.redirect('/admin/guests')
})

app.get('/admin/guests', ensureLoggedIn, function (req, res){
    //get all guests from database, and show in admin/guests view
    Guest.find({}, function(err, guests) {
        if(err) { res.send(err) }

        res.render('admin/guests', {
            guests: guests
        });
    })
})

app.get('/admin/guest/:id/delete', ensureLoggedIn, function(req, res) {
    //find guest by GET request ID, remove, then redirect back
    Guest.findById(req.params.id).remove().exec(function(err) {
        if(err) { res.send(err) }

        res.redirect('/admin/guests')
    })
})

app.post('/admin/guests/create', ensureLoggedIn, function(req, res) {
    //create new guest
    var newGuest = new Guest({
        name: req.body.name,
        surname: req.body.surname,
        email: req.body.email
    })

    //save to database
    newGuest.save()

    res.redirect('/admin/guests')
});

/*
    END ADMIN ROUTES
 */


app.get('/', function(req, res){
    res.render('index', {})
})

app.get('/invite/:id', function(req, res) {
    //show invitation form to guest with his unique ID
    //find guest by its ID, render invitation-form with guest data
    Guest.findById(req.params.id, function(err, guest) {
        if(err) { res.send(err) }

        //format dates with html accessible format YYYY-MM-DD
        guest.arrival_date = moment(guest.invitation.arrival_date).format('YYYY-MM-DD')
        guest.departure_date = moment(guest.invitation.departure_date).format('YYYY-MM-DD')

        res.render('invitation-form', {
            guest: guest
        })
    })
})

app.post('/invite/:id', function(req, res) {
    //create new invitation object data
    var invitation = {
        arrival_date:       req.body.arrival_date,
        departure_date:     req.body.departure_date,
        hotel_id:           req.body.hotel_id,
        housing_budget:     req.body.housing_budget,
        spending_budget:    req.body.spending_budget,
    }

    //save changes to database, find guest by its ID, set its invitation key to new inviation data, redirect back
    Guest.update(
        {'_id': mongoose.Types.ObjectId(req.params.id)},
        {"$set" : { invitation: invitation }},
        {'upsert': true},
        function(err) {
            if(err) { res.send(err) }

            res.redirect('/invite/' + req.params.id)
        });
})

app.listen(8080)

