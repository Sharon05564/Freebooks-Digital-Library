
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const suggestionsList = document.getElementById('suggestions');

    searchInput.addEventListener('input', async () => {
        const query = searchInput.value.trim();
        if (query.length > 0) {
            const suggestions = await fetchSuggestions(query);
            displaySuggestions(suggestions);
        } else {
            suggestionsList.innerHTML = ''; // Clear suggestions when input is empty
        }
    });

    async function fetchSuggestions(query) {
        try {
            const response = await fetch(`/suggest?query=${encodeURIComponent(query)}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            return [];
        }
    }

    function displaySuggestions(suggestions) {
        suggestionsList.innerHTML = ''; // Clear previous suggestions
        suggestions.forEach((book) => {
            const listItem = document.createElement('li');
            listItem.textContent = book.title;
            listItem.addEventListener('click', () => {
                searchInput.value = book.title;
                suggestionsList.innerHTML = '';
            });
            suggestionsList.appendChild(listItem);
        });
    }
});
