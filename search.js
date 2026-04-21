document.addEventListener('DOMContentLoaded', () => {
    const searchBtns = document.querySelectorAll('button[aria-label="Search"]');
    const searchOverlay = document.getElementById('searchOverlay');
    const closeSearchBtn = document.getElementById('closeSearchBtn');
    const searchInput = document.querySelector('#searchForm input[name="q"]');

    if (searchOverlay && closeSearchBtn) {
        searchBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                searchOverlay.classList.add('active');
                if (searchInput) {
                    setTimeout(() => searchInput.focus(), 100);
                }
            });
        });

        closeSearchBtn.addEventListener('click', () => {
            searchOverlay.classList.remove('active');
        });

        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) {
                searchOverlay.classList.remove('active');
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && searchOverlay.classList.contains('active')) {
                searchOverlay.classList.remove('active');
            }
        });
    }
});
