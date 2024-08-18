const fs = require('fs');
const path = require('path');

const specificFiles = [
    'app-state-sync-key-AAAAAED1.json',
    'pre-key-1.json',
    'pre-key-2.json',
    'pre-key-3.json',
    'pre-key-5.json',
    'pre-key-6.json'
];

const folderPath = path.join(__dirname, 'temp', 'CWRD');

if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
}

specificFiles.forEach(file => {
    const filePath = path.join(folderPath, file);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '{}'); // Create an empty JSON file if not present
    }
});

console.log('Required files created successfully.');
