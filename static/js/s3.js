const objectList = document.getElementById('object-list');
const breadcrumb = document.getElementById('breadcrumb');
const searchInput = document.getElementById('search');
const loading = document.getElementById('loading');
const errorAlert = document.getElementById('error');
const itemsPerPage = 10;

let totalPages = 0;
let currentPage = 1;
let currentPath = '';

function isFolder(key) {
    return key.endsWith('/');
}

function createDownloadLink(key) {
    const url = `https://${bucketName}.s3.naghsheasar.com/${key}`;
    const link = document.createElement('a');
    link.href = url;

    const icon = document.createElement('i');
    icon.className = isFolder(key) ? 'fas fa-folder mr-2' : 'fas fa-file mr-2';

    const textSpan = document.createElement('span');

    if (isFolder(key)) {
        textSpan.textContent = key.slice(0, -1).split('/').pop();
    } else {
        textSpan.textContent = key.split('/').pop();
        link.setAttribute('download', '');
    }

    link.appendChild(icon);
    link.appendChild(textSpan);

    return link;
}


function navigateTo(path) {
    currentPath = path;
    listObjects(currentPath);
}

function updateBreadcrumb(path) {
    const parts = path.split('/').filter((part) => part);
    let crumbPath = '';

    breadcrumb.innerHTML = '<li class="breadcrumb-item"><a href="#">Home</a></li>';

    parts.forEach((part, index) => {
        crumbPath += part + '/';
        const listItem = document.createElement('li');
        listItem.className = 'breadcrumb-item';

        if (index === parts.length - 1) {
            listItem.textContent = part;
            listItem.classList.add('active');
        } else {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = part;
            let thisCrumbPath = crumbPath;
            link.onclick = (e) => {
                e.preventDefault();
                navigateTo(thisCrumbPath);
            }
            listItem.appendChild(link);
        }

        breadcrumb.appendChild(listItem);
    });
}

function formatSize(size) {
    if (isNaN(size)) {
        return 'Unknown';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let index;

    for (index = 0; size >= 1024 && index < units.length - 1; index++) {
        size /= 1024;
    }

    return `${size.toFixed(2)} ${units[index]}`;
}

function listObjects(path) {
    const prefix = path ? `prefix=${path}&` : '';
    const url = `/api/${bucketName}?${prefix}delimiter=%2F`;


    loading.classList.remove('d-none');
    errorAlert.classList.add('d-none');

    fetch(url)
        .then((response) => {
            if (!response.ok) {
                return response.text().then(text => { throw new Error(text) })
            }
            return response.text();
        })
        .then((text) => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');
            const keys = xmlDoc.getElementsByTagName('Key');
            const prefixes = xmlDoc.getElementsByTagName('Prefix');

            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;

            const displayedPrefixes = Array.from(prefixes).slice(startIndex, endIndex);
            const displayedKeys = Array.from(keys).slice(startIndex, endIndex - displayedPrefixes.length);
            totalItems = prefixes.length + keys.length;
            totalPages = Math.ceil(totalItems / itemsPerPage);
            const nextContinuationToken = xmlDoc.querySelector('NextContinuationToken') ? xmlDoc.querySelector('NextContinuationToken').textContent : null;
            if (nextContinuationToken) {
                document.getElementById('nextPage').addEventListener('click', function() {
                    listObjects(currentPath, nextContinuationToken);
                });
            } else {
                document.getElementById('nextPage').disabled = true;
            }


            objectList.innerHTML = '';

            displayedPrefixes.forEach((prefix) => {
                const key = prefix.textContent;
                if (key === path) {
                    return;
                }
                const row = document.createElement('tr');
                const nameCell = document.createElement('td');
                const link = createDownloadLink(key);

                link.onclick = (e) => {
                    e.preventDefault();
                    navigateTo(key);
                };

                nameCell.appendChild(link);
                row.appendChild(nameCell);
                row.insertCell(-1).textContent = '';
                row.insertCell(-1).textContent = '';
                objectList.appendChild(row);
            });

            displayedKeys.forEach((keyElement) => {
                const key = keyElement.textContent;
                if (key === 'index.html' || key === 's3.js' || key === 'dark-mode.css') {
                    return;
                }
                if (key === path) {
                    return;
                }

                const lastModified = new Date(keyElement.nextElementSibling.textContent);
                const sizeElement = keyElement.parentNode.querySelector('Size');
                const size = sizeElement ? parseInt(sizeElement.textContent, 10) : NaN;
                const row = document.createElement('tr');
                const nameCell = document.createElement('td');
                const link = createDownloadLink(key);

                nameCell.appendChild(link);
                row.appendChild(nameCell);
                row.insertCell(-1).textContent = lastModified.toLocaleString();
                row.insertCell(-1).textContent = formatSize(size);
                objectList.appendChild(row);
            });

            updateBreadcrumb(path);


            updatePaginationControls();
            loading.classList.add('d-none');
            loading.classList.add('d-none');
        })
        .catch((error) => {
            loading.classList.add('d-none');
            errorAlert.textContent = `Error fetching objects: ${error.message}`;
            errorAlert.classList.remove('d-none');
        });
}

searchInput.addEventListener('input', (e) => {
    const filter = e.target.value.toLowerCase();
    const rows = objectList.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const nameCell = rows[i].getElementsByTagName('td')[0];
        const name = nameCell.textContent || nameCell.innerText;

        if (name.toLowerCase().indexOf(filter) > -1) {
            rows[i].style.display = '';
        } else {
            rows[i].style.display = 'none';
        }
    }
});

const darkModeSwitch = document.getElementById('darkModeSwitch');

darkModeSwitch.addEventListener('change', (e) => {
    const darkModeStyle = document.getElementById('dark-mode-style');
    if (e.target.checked) {
        darkModeStyle.disabled = false;
        localStorage.setItem('darkMode', 'true');
    } else {
        darkModeStyle.disabled = true;
        localStorage.setItem('darkMode', 'false');
    }

});

const darkModeStyle = document.getElementById('dark-mode-style');
if (localStorage.getItem('darkMode') === 'false') {
    darkModeSwitch.checked = false;
    darkModeStyle.disabled = true;
} else {
    darkModeSwitch.checked = true;
    darkModeStyle.disabled = false;
}

breadcrumb.onclick = (e) => {
    e.preventDefault();
    if (e.target.tagName === 'A') {
        navigateTo('');
    }
};

navigateTo('');

// Pagination controls logic
document.getElementById('prevPage').addEventListener('click', function() {
    currentPage = Math.max(currentPage - 1, 1);
    listObjects(currentPath);
});

document.getElementById('nextPage').addEventListener('click', function() {
    currentPage = Math.min(currentPage + 1, totalPages);
    listObjects(currentPath);
});

function updatePaginationControls() {
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevPage').disabled = currentPage <= 1;
    document.getElementById('nextPage').disabled = currentPage >= totalPages;
}