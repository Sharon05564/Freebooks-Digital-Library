FreeBooks Digital Library
=======================================================================
Overview
FreeBooks Digital Library is a web-based application that allows users to search, view, and save free books from a wide range of categories. It integrates with the Google Books API to fetch trending and free e-books and provides a seamless login experience with traditional email/password as well as Google OAuth authentication. Users can manage their profiles, save their favorite books, and interact with the application via an intuitive interface.

Features
========
Search for Free Books: Users can search for free e-books by title, author, or category using the Google Books API.
Trending Books: Display of trending books fetched from Google Books.
User Authentication: Secure login and registration using JWT. OAuth login with Google is also supported.
Save Books: Users can save their favorite books for later reference.
Profile Management: Update and view profile details.
Contact Form: Users can send messages via the contact form, which sends emails to the admin.

Project Structure
=================
graphql

|-- config/                     # Configuration files
|   |-- database.js             # Database configuration (MySQL via Sequelize)
|   |-- passport.js             # Google OAuth configuration using Passport
|-- models/                     # Sequelize models
|   |-- SavedBook.js            # Model for saved books
|   |-- User.js                 # Model for user accounts
|-- public/                     # Static files (HTML, CSS, JavaScript)
|   |-- js/                     # Client-side JavaScript files
|   |   |-- script.js           # General scripting for the app
|   |   |-- contact.js          # JavaScript for contact form behavior
|   |   |-- trending.js         # JavaScript for trending books
|-- routes/                     # Express route files
|   |-- authRoutes.js           # Routes for authentication (login, registration, Google OAuth)
|   |-- bookRoutes.js           # Routes for book search using Google Books API
|   |-- savedRoutes.js          # Routes for managing saved books
|   |-- profileRoutes.js        # Routes for user profile management
|-- migrations/                 # Sequelize migrations
|-- .env                        # Environment variables (not included in version control)
|-- server.js                   # Entry point for the Express application
|-- README.md                   # Project documentation


Getting Started
Prerequisites
Node.js
MySQL
Google OAuth credentials (Client ID and Client Secret)
Google Books API Key

Installation
Clone the repository:
git clone https://github.com/your-repo/freebooks-digital-library.git
cd freebooks-digital-library
Install dependencies:

bash

npm install
Configure environment variables: Create a .env file in the root directory and provide the following:

makefile

GOOGLE_BOOKS_API_KEY=your-google-books-api-key
MYSQL_DB=freebooksdb
MYSQL_USER=root
MYSQL_PASSWORD=1234
MYSQL_HOST=localhost
PORT=3000
JWT_SECRET=your-jwt-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
Set up MySQL Database:

Ensure your MySQL server is running.
Create a database:
sql

CREATE DATABASE freebooksdb;
Run Sequelize migrations:

bash

npx sequelize-cli db:migrate
Running the Application
bash

npm start
The application will be running on http://localhost:3000.

Usage
Authentication
Register: Users can create an account using email and password.
Login: Users can log in using their registered credentials or with Google OAuth.
Profile Management: Users can update their profiles directly from the app.
Book Search and Save
Search: Enter keywords to search for books using the Google Books API.
Trending Books: Automatically fetches and displays trending books.
Save Books: Save any book to view later from your profile.
Contact Us
The contact form on the website allows users to send messages to the admin email.

Built With
Node.js - JavaScript runtime environment
Express - Web framework for Node.js
Sequelize - ORM for MySQL
Passport - Authentication middleware
Google Books API - Fetch free e-books
JWT - Secure authentication
Contributing
Feel free to open issues or submit pull requests for improvements. Contributions are welcomed!

License
This project is licensed under the MIT License - see the LICENSE file for details.

Acknowledgments
Special thanks to Google Books for providing access to their API.
Thank you to Passport.js for making OAuth integration seamless.
