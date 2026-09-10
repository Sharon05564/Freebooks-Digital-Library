// Pagination settings
let startIndex = 0;
const maxResults = 10;

// Retrieve the query from the URL
const urlParams = new URLSearchParams(window.location.search);
const query = urlParams.get('q');
const category = urlParams.get('category');

// Set the search input value on the page load
document.addEventListener('DOMContentLoaded', () => {
    if (query) {
        document.getElementById('searchBar').value = query;
        fetchBooks();
    }
});

// Search button click event in index.html
document.getElementById('searchBtn').addEventListener('click', () => {
    const query = document.getElementById('searchBar').value.trim();
    const category = document.getElementById('categorySelect').value;

    if (query) {
        window.location.href = `search.html?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`;
    } else {
        alert('Please enter a search term.');
    }
});


// Next button click event
document.getElementById('nextBtn').addEventListener('click', async () => {
    startIndex += maxResults;
    await fetchBooks();
});

// Previous button click event
document.getElementById('prevBtn').addEventListener('click', async () => {
    if (startIndex >= maxResults) {
        startIndex -= maxResults;
        await fetchBooks();
    }
});

// Function to fetch books
async function fetchBooks() {
    if (!query) {
        alert('No search term provided.');
        return;
    }

    try {
        const response = await fetch(
            `/books/search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&startIndex=${startIndex}&maxResults=${maxResults}`
        );

        if (!response.ok) {
            throw new Error('Error fetching books.');
        }

        const books = await response.json();

        if (!books || books.length === 0) {
            document.getElementById('results').innerHTML = '<p>No books found. Try a different search.</p>';
            togglePaginationButtons(0); // Hide pagination buttons
            return;
        }

        displayBooks(books);
        togglePaginationButtons(books.length);
    } catch (error) {
        console.error('Error fetching books:', error);
        alert('Something went wrong while fetching the books. Please try again.');
    }
}

// Function to display books
function displayBooks(books) {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = ''; // Clear previous results

    const output = books.map((book) => {
        const title = book.volumeInfo?.title || 'Title not available';
        const authors = book.volumeInfo?.authors?.join(', ') || 'Author(s) not available';
        const imageUrl = book.volumeInfo?.imageLinks?.thumbnail || 'https://via.placeholder.com/128x190?text=No+Cover';
        const bookLink = book.volumeInfo?.infoLink || '#';

        // Title/authors/imageUrl come from a third-party API - escape before
        // inserting into innerHTML so they can't inject markup or break out
        // of the href/src attributes.
        return `
            <a href="${escapeHtml(bookLink)}" target="_blank" class="book-link">
                <div class="book-card">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)} cover" class="book-cover">
                    <h3>${escapeHtml(title)}</h3>
                    <p>${escapeHtml(authors)}</p>
                </div>
            </a>
        `;
    }).join(''); // Join all book cards into a single string

    resultsContainer.innerHTML = output;
}

// Function to toggle pagination buttons
function togglePaginationButtons(bookCount) {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    // Show/Hide Previous button
    prevBtn.style.display = startIndex > 0 ? 'inline-block' : 'none';

    // Show/Hide Next button based on the number of results returned
    nextBtn.style.display = bookCount === maxResults ? 'inline-block' : 'none';
}
