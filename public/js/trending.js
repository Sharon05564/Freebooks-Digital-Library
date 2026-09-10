async function fetchTrendingBooks() {
    try {
        const response = await fetch('/books/trending');

        if (!response.ok) {
            throw new Error('Failed to fetch trending books');
        }

        const books = await response.json();

        if (!books || books.length === 0) {
            document.getElementById('trending-books-list').innerHTML = '<p>No trending books found.</p>';
            return;
        }

        displayTrendingBooks(books);
    } catch (error) {
        console.error('Error fetching trending books:', error);
        document.getElementById('trending-books-list').innerHTML = '<p>Unable to load trending books.</p>';
    }
}

// Call this function when the page loads to fetch trending books
window.addEventListener('load', fetchTrendingBooks);

function displayTrendingBooks(books) {
    const trendingContainer = document.getElementById('trending-books-list');

    const output = books.map((book) => {
        const title = book.volumeInfo?.title || 'Title not available';
        const authors = book.volumeInfo?.authors?.join(', ') || 'Author(s) not available';
        const imageUrl = book.volumeInfo?.imageLinks?.thumbnail || 'default-cover.jpg';
        const bookLink = book.volumeInfo?.infoLink || '#';

        return `
            <a href="${escapeHtml(bookLink)}" target="_blank" class="book-link">
                <div class="book-card">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)} cover" class="book-cover">
                    <h3>${escapeHtml(title)}</h3>
                    <p>${escapeHtml(authors)}</p>
                </div>
            </a>
        `;
    }).join('');

    trendingContainer.innerHTML = output;
}
