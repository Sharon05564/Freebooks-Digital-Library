document.getElementById('contactForm').addEventListener('submit', function (event) {
    event.preventDefault();

    // Gather form data
    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        subject: document.getElementById('subject').value,
        message: document.getElementById('message').value,
    };

    // Send the form data to your server
    fetch('/api/sendMessage', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    })
        .then(response => {
            if (response.ok) {
                alert('Message sent successfully!');
                // Optionally, reset the form
                document.getElementById('contactForm').reset();
            } else {
                alert('There was an error sending your message.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('There was an error sending your message.');
        });
});

// Update navbar based on user login status
function updateNavbar() {
    const user = JSON.parse(localStorage.getItem('user'));

    if (user) {
        document.getElementById('userNav').innerHTML = `<a href="/profile.html">${user.username}</a>`;
        document.getElementById('savedItems').style.display = 'inline';
        document.getElementById('logoutBtn').style.display = 'inline';
        document.getElementById('loginButton').style.display = 'none';
    } else {
        document.getElementById('userNav').innerHTML = '';
        document.getElementById('savedItems').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'none';
        document.getElementById('loginButton').style.display = 'inline';
    }
}

// Logout function
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        alert('Logged out successfully!');
        window.location.href = 'index.html';
    });

    // Update navbar on load
    updateNavbar();
});

