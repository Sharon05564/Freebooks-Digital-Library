
const apiKey = 'AIzaSyAczTBR1LOL_OcJb_EOFfzEg440go6Z2hw';

async function fetchTrendingBooks() {
    try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=computer+action+fiction+OR+nonfiction&filter=free-ebooks&maxResults=5&key=${apiKey}`);

        if (!response.ok) {
            throw new Error('Failed to fetch trending books');
        }

        const books = await response.json();

        // Check if books are available
        if (!books.items || books.items.length === 0) {
            document.getElementById('trending-books-list').innerHTML = '<p>No trending books found.</p>';
            return;
        }

        displayTrendingBooks(books.items);
    } catch (error) {
        console.error('Error fetching trending books:', error);
        document.getElementById('trending-books-list').innerHTML = '<p>Unable to load trending books.</p>';
    }
}

// Call this function when the page loads to fetch trending books
window.addEventListener('load', fetchTrendingBooks);

function displayTrendingBooks(books) {
    const trendingContainer = document.getElementById('trending-books-list');
    let output = '';

    books.forEach(book => {
        const title = book.volumeInfo?.title || 'Title not available';
        const authors = book.volumeInfo?.authors?.join(', ') || 'Author(s) not available';
        const imageUrl = book.volumeInfo?.imageLinks?.thumbnail || 'default-cover.jpg'; // Default cover image
        const bookLink = book.volumeInfo?.infoLink || '#'; // Link to book info

        output += `
            <a href="${bookLink}" target="_blank" class="book-link">
                <div class="book-card">
                    <img src="${imageUrl}" alt="${title} cover" class="book-cover">
                    <h3>${title}</h3>
                    <p>${authors}</p>
                </div>
            </a>
        `;
    });

    trendingContainer.innerHTML = output;
}
