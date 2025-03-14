require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true, // or specify your frontend origin
  credentials: true
}));
app.use('/images', express.static(path.join(__dirname, '../frontend/images')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, '../frontend')));

mongoose.connect(process.env.MONGODB_URI, {})
  .then(() => console.log('✅ Connected to MongoDB Atlas (Database: travel)'))
  .catch((error) => console.error('❌ Error connecting to MongoDB:', error));



app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const User = mongoose.model('login', userSchema);



const bookingSchema = new mongoose.Schema({
  bookingReference: { 
    type: String, 
    required: true, 
    unique: true  
  },
  userEmail: { type: String, required: true },
  destination: { type: String, required: true },
  travelerName: { type: String, required: true },
  departureDate: { type: String },
  returnDate: { type: String },
  numTravelers: { type: Number, required: true },
  accommodationType: { type: String },
  flightDetails: {
    airline: String,
    flightNumber: String,
    departure: String,
    arrival: String,
    duration: String
  },
  pricing: {
    basePrice: Number,
    accommodationPrice: Number,
    activitiesCost: Number,
    flightCost: Number,
    totalAmount: Number
  },
  paymentInfo: {
    transactionId: String,
    paymentMethod: String,
    paymentDate: String,
    paymentStatus: String
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});


bookingSchema.index(
  { 
    userEmail: 1, 
    destination: 1, 
    departureDate: 1, 
    returnDate: 1,
    travelerName: 1
  }, 
  { unique: true }
);

const Booking = mongoose.model('Booking', bookingSchema);

app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;

  try {
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long, with one uppercase letter, one lowercase letter, one number, and one special character.',
      });
    }

    const newUser = new User({ username, email, password });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Account already exists! Login to continue...', error });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username, password });
    if (user) {
      req.session.user = { username: user.username, email: user.email };
      
      
      const redirect = req.query.redirect;
      if (redirect) {
        return res.status(200).json({ 
          message: 'Login successful', 
          username: user.username,
          redirect: `/${redirect}`
        });
      }
      
      res.status(200).json({ message: 'Login successful', username: user.username });
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Error during login', error });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: 'Error logging out' });
    }
    res.status(200).json({ message: 'Logged out successfully' });
  });
});
app.get('/api/auth/status', (req, res) => {
  if (req.session.user) {
    res.status(200).json({ 
      loggedIn: true, 
      username: req.session.user.username,
      email: req.session.user.email
    });
  } else {
    res.status(200).json({ loggedIn: false });
  }
});

app.post('/api/bookings', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'User not logged in' });
  }

  const {
    bookingReference,
    destination,
    travelerName,
    departureDate,
    returnDate,
    numTravelers,
    accommodationType,
    flightDetails,
    pricing,
    paymentInfo
  } = req.body;

  // Validation for required fields
  if (!bookingReference || !destination || !travelerName || !numTravelers || !pricing || !paymentInfo) {
    return res.status(400).json({ message: 'Missing required booking details' });
  }

  try {
    // Check for existing booking using more criteria than just bookingReference
    const existingBooking = await Booking.findOne({
      $or: [
        { bookingReference },
        {
          userEmail: req.session.user.email,
          destination,
          departureDate,
          returnDate,
          travelerName,
          
        }
      ]
    });

    if (existingBooking) {
     
      return res.status(409).json({ 
        message: 'This booking already exists in your account',
        existingBookingId: existingBooking._id 
      });
    }

    const newBooking = new Booking({
      bookingReference,
      userEmail: req.session.user.email,
      destination,
      travelerName,
      departureDate,
      returnDate,
      numTravelers,
      accommodationType,
      flightDetails,
      pricing,
      paymentInfo
    });

    await newBooking.save();
    res.status(201).json({ 
      message: '✅ Booking stored successfully',
      bookingId: newBooking._id
    });
  } catch (error) {
    console.error('Error storing booking:', error);
    res.status(500).json({ message: '❌ Error storing booking', error: error.message });
  }
});
const destinationImageMap = {
  "Paris, France": "paris.png",
  "Tokyo, Japan": "tokyo.png",
  "Rome, Italy": "rome.png",
  "Barcelona, Spain": "barcelona.png",
  "Iceland" : "iceland.png",
  "Tokyo, Japan" : "tokyo.jpg",
  "Ha Long Bay, Vietnam" : "vietnam.png",
  "New York City, USA" : "newyork.png",
  "Santorini, Greece" : "greece.png",
  "Machu Picchu, Peru" : "machu.png",
  "Maldives" : "maldives.png",
  "Dubai, UAE" : "dubai.png",
  "Bali, Indonesia" : "bali.png",
  "Cape Town, South Africa" : "capetwon.png",
  "Sydney, Australia" : "sydney.png",
  "Swiss Alps, Switzerland" : "swiss-alps.png",
  "Kyoto, Japan" : "kyoto.png",
  "Marrakech, Morocco" : "marrakech.png",
  "Rio de Janeiro, Brazil" : "rio.png",
  "Amsterdam, Netherlands" : "amsterdam.png",
  "Petra, Jordan" : "petra.png",
  "Queenstown, New Zealand" : "queenstown.png",
  "Amalfi Coast,Italy" : "amalfi.png",
  "Havana, Cuba" : "havana.png",
  "Cairo, Egypt" : "cairo.png",
  "Seychelles" : "seychelles.png",
  "Singapore" : "singapore.png"
};

app.get('/api/my-bookings', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'User not logged in' });
  }

  try {
    const userEmail = req.session.user.email;
    const bookings = await Booking.find({ userEmail });
    
    const formattedBookings = bookings.map(booking => {
      // Get image from map or use default transformation if not found
      const imageFilename = destinationImageMap[booking.destination] || 
                           `${booking.destination.toLowerCase().replace(/\s+/g, '-')}.jpg`;
      
      return {
        _id: booking._id,
        destination: booking.destination,
        status: booking.paymentInfo.paymentStatus === 'Confirmed' ? 'confirmed' : 'pending',
        checkIn: booking.departureDate,
        checkOut: booking.returnDate,
        guests: booking.numTravelers,
        price: booking.pricing.totalAmount,
        imageUrl: `/images/${imageFilename}`
      };
    });
    
    res.status(200).json(formattedBookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Error fetching bookings', error });
  }
});
app.post('/api/bookings/:id/cancel', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'User not logged in' });
  }

  try {
    const bookingId = req.params.id;
    const userEmail = req.session.user.email;
    
    // Find the booking and ensure it belongs to the current user
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    if (booking.userEmail !== userEmail) {
      return res.status(403).json({ message: 'Unauthorized: This booking belongs to another user' });
    }
    
    // Update booking status
    booking.paymentInfo.paymentStatus = 'Cancelled';
    await booking.save();
    
    res.status(200).json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ message: 'Error cancelling booking', error });
  }
});


app.get('/destinations', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/explore.html'));
});
app.get('/payment-success', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/paymentsuccessful.html'));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});


app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
