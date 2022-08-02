const express = require('express');
const SSLCommerzPayment = require('sslcommerz-lts')
const bodyParser = require('body-parser')
const app = express()
const fs = require('firebase-admin');
const serviceAccount = require('./firebase.json');
require('dotenv').config()
var filesys = require('fs');
var moment = require('moment');

var htmlFile;

filesys.readFile('./success.html', function(err, data) {
    if (err){
        throw err;
    }
    htmlFile = data;
});

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json());

app.get('/', async (req, res) => {

  /** 
  * Root url response 
  */

  return res.status(200).json({
    message: "Welcome to sslcommerz app",
    url: `${process.env.ROOT}/ssl-request`
  })
})

fs.initializeApp({
 credential: fs.credential.cert(serviceAccount)
});

const db = fs.firestore();

app.get("/trips", async (req, res) => {

	let data = []
	const querySnapshot = await db.collection("trips").get();
	querySnapshot.forEach((doc) => {
		data.push(doc.data());
	});

  res.status(200).json(data);
})

app.get('/ssl-request', async (req, res) => {

  /** 
  * Create ssl session request 
  */
  const data = {
    total_amount: req.query.amount,
    currency: 'BDT',
    tran_id: 'REF123',
    success_url: `${process.env.ROOT}/ssl-payment-success`,
    fail_url: `${process.env.ROOT}/ssl-payment-fail`,
    cancel_url: `${process.env.ROOT}/ssl-payment-cancel`,
    shipping_method: 'No',
    product_name: 'Computer.',
    product_category: 'Electronic',
    product_profile: 'general',
    cus_name: 'Customer Name',
    cus_email: 'cust@yahoo.com',
    cus_add1: 'Dhaka',
    cus_add2: 'Dhaka',
    cus_city: 'Dhaka',
    cus_state: 'Dhaka',
    cus_postcode: '1000',
    cus_country: 'Bangladesh',
    cus_phone: '01711111111',
    cus_fax: '01711111111',
    multi_card_name: 'mastercard',
    value_a: req.query.trip_id,
	value_b: req.query.user_id,
	value_c: req.query.route_id,
	value_d: req.query.seats,
    ipn_url: `${process.env.ROOT}/ssl-payment-notification`,
  };

  const sslcommerz = new SSLCommerzPayment(process.env.STORE_ID, process.env.STORE_PASSWORD, false) //true for live default false for sandbox
  sslcommerz.init(data).then(data => {

    //process the response that got from sslcommerz 
    //https://developer.sslcommerz.com/doc/v4/#returned-parameters

    if (data?.GatewayPageURL) {
      return res.status(200).redirect(data?.GatewayPageURL);
    }
    else {
      return res.status(400).json({
        message: "Session was not successful"
      });
    }
  });

});

app.post("/ssl-payment-notification", async (req, res) => {

  /** 
  * If payment notification
  */

  return res.status(200).json(
    {
      data: req.body,
      message: 'Payment notification'
    }
  );
})

app.post("/ssl-payment-success", async (req, res) => {

  /** 
  * If payment successful payloads
  *value_a: req.query.trip_id,
  *value_b: req.query.user_id,
  *value_c: req.query.route_id,
  *value_d: req.query.seats,
  */
  
	const querySnapshot = await db.collection("trips").doc(req.body.value_a).get();
	let trip = querySnapshot.data();
	trip['id'] = querySnapshot.id;

	let checkSeats = false;
	let checkFlag = false;
	let alreadyBooked = '';
	let requestSeat = req.body.value_d.split('_').map( Number );
	let processSeat = [];
	let updatedSeat = [];

	for (let s of trip.seats) {
	  checkSeats = requestSeat.find(rs_date_time => (rs_date_time == s.date_time && s.booked));
	  if(checkSeats){
		checkFlag = true;
		alreadyBooked += ` ${s.name}`;
	  }
	  if(!checkFlag && requestSeat.includes(s.date_time)){
		  s.booked = true;
		  s.user = req.body.value_b;
		  updatedSeat.push(s);
		  processSeat.push({name: s.name, date_time: s.date_time});
	  }else if(!checkFlag){
		  updatedSeat.push(s);
	  }
	}
	let route = trip.routes.find(r => r.id == req.body.value_c);

	if(checkFlag){
		res.writeHead(200, {"Content-Type": "text/plain"});
		res.write(`You are late! Someone has booked seat(s) ${alreadyBooked} recently! Press close button and book available seats.` );
		res.end();
	}else if(route){
		const formData = {
			user_id : req.body.value_b,
			transaction_code: req.body.bank_tran_id,
			trip_id: trip.id,
			bus_name: trip.bus_name,
			trip_date: trip.date,
			trip_time: trip.start_time,
			route: route,
			fares: req.body.amount,
			seats: processSeat,
			status: 2,
			booked_date: moment().format('YYYY-MM-DD'),
			booked_time: moment().format('hh:mm A')
		}
		db.collection('bookings')
		  .add(formData)
		  .then((docRef) => {
			  db.collection('trips').doc(trip.id)
				.update({seats: updatedSeat})
				.then(() => {
					res.writeHead(200, {"Content-Type": "text/html"});
					res.write(htmlFile);
				});
		  });
	}
  
})

app.post("/ssl-payment-fail", async (req, res) => {

  /** 
  * If payment failed 
  */

  return res.status(200).json(
    {
      data: req.body,
      message: 'Payment failed'
    }
  );
})

app.post("/ssl-payment-cancel", async (req, res) => {

  /** 
  * If payment cancelled 
  */

  return res.status(200).json(
    {
      data: req.body,
      message: 'Payment cancelled'
    }
  );
})

app.listen(process.env.PORT, () =>
  console.log(`ssl app listening on port ${process.env.PORT}!`),
);