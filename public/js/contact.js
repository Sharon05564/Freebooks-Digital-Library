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

