const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const app = express();
const port = 3000;

const users = [
    { id: 1, username: 'user1', password: 'password1', role: 'user' },
    { id: 2, username: 'admin1', password: 'adminpassword1', role: 'admin' }
];

const failedLoginAttempts = {}; // Store failed attempts per user
const blockedUsers = {}; // Store blocked users
const userActivities = {}; // Store user activities

app.use(bodyParser.json());

app.use(session({
    secret: 'your-secret-key-goes-here',
    resave: false,
    saveUninitialized: true
}));

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (blockedUsers[username]) {
        // Check if the user is still blocked
        const remainingTime = (blockedUsers[username] - Date.now()) / 1000;
        console.log(`[WARN] Blocked user ${username} attempting login. Remaining block time: ${remainingTime} seconds`);
        res.status(403).json({ message: `User ${username} is blocked. Please wait for the block to expire.` });
        return;
    }

    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        // Reset failed attempts on successful login
        failedLoginAttempts[username] = 0;

        req.session.user = user;

        // Log successful login and update user activities
        console.log(`[INFO] Successful login: ${user.username} (${user.role})`);
        logUserActivity(username, `Login successful`);

        res.json({ message: 'Authentication successful', user });
    } else {
        // Increment failed attempts and check if user should be blocked
        failedLoginAttempts[username] = (failedLoginAttempts[username] || 0) + 1;

        if (failedLoginAttempts[username] >= 3) {
            // Block the user for 5 minutes (300 seconds)
            blockedUsers[username] = Date.now() + 300000; // Block until the current time + 5 minutes
            console.log(`[WARN] Blocking user ${username} for 5 minutes due to consecutive failed attempts`);
            logUserActivity(username, `Blocked for consecutive failed login attempts`);
            res.status(403).json({ message: `User ${username} is blocked. Please wait for the block to expire.` });
            return;
        }

        console.log(`[WARN] Failed login attempt for username: ${username}`);
        logUserActivity(username, `Failed login attempt`);

        res.status(401).json({ message: 'Authentication failed' });
    }
});

app.get('/admin/dashboard', (req, res) => {
    const user = req.session.user;

    if (user && user.role === 'admin') {
        console.log(`[INFO] Access to admin dashboard: ${user.username}`);
        logUserActivity(user.username, `Accessed admin dashboard`);
        res.json({ message: 'Welcome to the admin dashboard', user });
    } else {
        console.log(`[WARN] Unauthorized access attempt to /admin/dashboard`);
        logUserActivity(user.username, `Unauthorized attempt to access admin dashboard`);
        res.status(403).json({ message: 'Authorization failed' });
    }
});

app.get('/home', (req, res) => {
    const user = req.session.user;

    if (user) {
        console.log(`[INFO] Access to home page: ${user.username}`);
        logUserActivity(user.username, `Accessed home page`);
        res.json({ message: 'Welcome to the home page', user });
    } else {
        console.log(`[WARN] Unauthorized access attempt to /home`);
        logUserActivity(user.username, `Unauthorized attempt to access home page`);
        res.status(403).json({ message: 'Authorization failed' });
    }
});

app.use(express.static(path.join(__dirname, 'index.html')));

app.get('*', (req, res) => {
    console.log(`[WARN] Unknown route accessed: ${req.originalUrl}`);
    logUserActivity(req.session.user ? req.session.user.username : 'Unknown', `Attempted to access unknown route: ${req.originalUrl}`);
    res.sendFile(path.join(__dirname,  'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

function logUserActivity(username, activity) {
    const timestamp = new Date().toLocaleString();
    if (!userActivities[username]) {
        userActivities[username] = [];
    }
    userActivities[username].push({ timestamp, activity });
    console.log(`[INFO] User activity logged: ${username} - ${activity}`);
}
