console.log("writer installed correctly")

// CLASES:
class DbHandler {
    constructor(dbName, version=1) {
        this.dbname = dbName;
        this.version = version;
        this.database = null;
    }
    getRequest() {
        return window.indexedDB.open(this.dbName, this.version);
    }
    async getDataBase() {
        return new Promise((resolve, reject) => {
            if (this.database) {
                return resolve(this.database);
            }
            
            let request = this.getRequest();

            request.onerror = event => {
                console.log('ERROR: Unable to open database', event);
                reject('Error');
            }

            request.onsuccess = event => {
                console.log(`SUCCESS: Database ${this.dbname} opened successfully`)
                this.database = event.target.result;
                resolve(this.database);
            }

            request.onupgradeneeded = event => {
                console.log('UPGRADE: Database was upgraded')
                let database = event.target.result;
                database.createObjectStore('words', {
                    autoIncrement: true
                });
            }
        });
    }

    async getWordsStore() {
        this.database = await this.getDataBase();

        return new Promise((resolve, reject) => {
            const transaction = this.database.transaction('words', 'readonly');
            const store = transaction.objectStore('words');
            let wordList = [];

            store.openCursor().onsuccess = event => {
                let cursor = event.target.result;

                if (cursor) {
                    wordList.push(cursor.value)
                    cursor.continue()
                } 
            }

            transaction.oncomplete = () => {
                resolve(wordList);
            }

            transaction.onerror = event => {
                reject(event);
            }
        });
    }
    
    async saveWord(word, wordsFrequency) {
        this.database = await this.getDataBase();

        return new Promise((resolve, reject) => {
            const transaction = this.database.transaction('words', 'readwrite');
            const store = transaction.objectStore('words');

            store.put(wordsFrequency, word);

            transaction.oncomplete = () => {
                resolve('Item successfully saved');
            }

            transaction.onerror = event => {
                reject(event);
            }
        });
    }
}

class MarkovWriter {
    constructor() {
        this.words = {};
    }

    getStringWords(string) {
        return string.toLowerCase().trim()
        .replace(/[~`!@#$%^&*()+={}\[\];:\'\"<>.,\/\\\?-_]/g, '').split(" ");
    }

    addWordValue(word, nextWord) {
        nextWord = nextWord == undefined ? "": nextWord;

        if (this.words[word] == undefined) {
            this.words[word] = {};
        }

        if (this.words[word][nextWord] == undefined) {
            this.words[word][nextWord] = 0;
        }

        if (nextWord) {
            this.words[word][nextWord] += 1;
        }
    }

    getNextWord(word) {
        let entries = this.words[word];
        let maxProbability = Object.values(entries).reduce((a, b) => a + b, 0);  
        let bestMatch = "";

        for (let nextWord in entries) {
            let probability = Math.random() * maxProbability;

            if (probability <= entries[nextWord]) {
                bestMatch = nextWord
                break;
            }

            maxProbability -= probability;
        }

        return bestMatch;
    }

    parse(string) {
        let words = this.getStringWords(string);
        
        for (let index in words) {
            this.addWordValue(words[index], words[parseInt(index) + 1]);
        }
    }

    generate(string) {
        let lastWord = this.getStringWords(string).at(-1);
        let nextWord = this.getNextWord(lastWord);
       
        return nextWord
    }
}


// CONSTANTS:
const COMMAND_PATTERN = /w[.]/gi;
const WRITER = new MarkovWriter();
const DB_HANDLER = new DbHandler('donutDB', 1);

// INTERFACE
let observerConfig = {
    childList: true,
    characterData: true,
    subtree: true
}

function has_command(selector) {
    return selector.textContent.match(COMMAND_PATTERN);
}

function ends_with_space(selector) {
    return selector.textContent.slice(-1) == " ";
}

function set_cursor_at_end(selector) {
    let selection = window.getSelection();  
    let range = document.createRange();  
    selection.removeAllRanges();  
    range.selectNodeContents(selector);  
    range.collapse(false);  
    selection.addRange(range);  
    selector.focus();
}
function get_next_word(selector) {
    let string = selector.textContent.replaceAll(COMMAND_PATTERN, "");
    return WRITER.generate(string);
}

function set_word(selector, word) {
    selector.textContent = selector.textContent.replaceAll(COMMAND_PATTERN, word);
    set_cursor_at_end(selector)
}   

let observer = new MutationObserver(() => {
    let textBoxes = document.querySelectorAll("[role='textbox'] span[data-slate-string]")
    
    if (textBoxes.length) {
        if (ends_with_space(textBoxes[0])) {
            if (has_command(textBoxes[0])) {
                set_word(textBoxes[0], get_next_word(textBoxes[0]))
    
            } else {
                WRITER.parse(textBoxes[0].textContent)
            }
        }
    }
});

observer.observe(document.body, observerConfig)