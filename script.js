document.addEventListener('DOMContentLoaded', function() {
    window.jsPDF = window.jspdf.jsPDF;
    
    initializeMonth();
    setupSynchronization();
    setupFillButtons();
    setupClearButton();
});

const polishMonths = { "styczeń": 0, "luty": 1, "marzec": 2, "kwiecień": 3, "maj": 4, "czerwiec": 5, "lipiec": 6, "sierpień": 7, "wrzesień": 8, "październik": 9, "listopad": 10, "grudzień": 11 };
const polishMonthsTitleCase = [ "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień" ];

// Zmienna do śledzenia kolejności dyżurów w dni robocze
let monThursDutyCounter = 0;

function initializeMonth() {
    const today = new Date();
    today.setMonth(today.getMonth() + 1);
    const nextMonthName = polishMonthsTitleCase[today.getMonth()];
    const year = today.getFullYear();
    document.getElementById('miesiacInput').value = `${nextMonthName} ${year}`;
    aktualizujWszystko();
}

function zmienMiesiac(zmiana) {
    const miesiacInput = document.getElementById('miesiacInput');
    const parts = miesiacInput.value.toLowerCase().split(' ');
    if (parts.length < 2) return;
    const monthName = parts[0];
    const year = parseInt(parts[1], 10);
    if (!polishMonths.hasOwnProperty(monthName) || isNaN(year)) return;
    const monthIndex = polishMonths[monthName];
    const currentDate = new Date(year, monthIndex);
    currentDate.setMonth(currentDate.getMonth() + zmiana);
    const newMonthName = polishMonthsTitleCase[currentDate.getMonth()];
    const newYear = currentDate.getFullYear();
    miesiacInput.value = `${newMonthName} ${newYear}`;
    aktualizujWszystko();
}

function setupSynchronization() {
    const formularz = document.getElementById('formularz-edycji');

    formularz.addEventListener('input', (event) => {
        const editedCell = event.target;
        if (editedCell.tagName !== 'TD') return;

        const editedRow = editedCell.closest('tr');
        const cellIndex = editedCell.cellIndex;
        
        // 1. Standardowa synchronizacja edytowanej komórki do podglądu
        const previewRowId = editedRow.id.replace('form-', 'preview-');
        const previewRow = document.getElementById(previewRowId);
        if (previewRow) {
            const previewCell = previewRow.cells[cellIndex];
            previewCell.innerText = editedCell.innerText;
        
             // NOWA LOGIKA: Automatyczne godziny pracy po wpisaniu kodu
            // Sprawdzamy, czy edytowano kolumnę "KOD PRACY" (indeks 1)
            if (cellIndex === 1) {
        autoFillWorkHours(editedCell);        
        }
        }

        // 2. Logika automatycznych godzin dyżurów
        if (cellIndex === 4) {
            const dyzurOdDoCell = editedRow.cells[5];
            const iloscGodzinCell = editedRow.cells[6];
            const previewDyzurOdDoCell = previewRow.cells[5];
            const previewIloscGodzinCell = previewRow.cells[6];

            if (editedCell.innerText.trim().toUpperCase() === 'D') {
                const day = parseInt(editedRow.cells[0].innerText, 10);
                const miesiacInput = document.getElementById('miesiacInput').value.toLowerCase();
                const parts = miesiacInput.split(' ');
                const monthName = parts[0];
                const year = parseInt(parts[1], 10);
                const monthIndex = polishMonths[monthName];
                const dayOfWeek = new Date(year, monthIndex, day).getDay();

                if (dayOfWeek >= 1 && dayOfWeek <= 4) { // Poniedziałek - Czwartek
                    if (monThursDutyCounter % 2 === 0) {
                        dyzurOdDoCell.innerText = '15:05-20:10';
                        iloscGodzinCell.innerText = "5h 5'";
                    } else {
                        dyzurOdDoCell.innerText = '15:05-20:05';
                        iloscGodzinCell.innerText = '5h';
                    }
                    monThursDutyCounter++;
                } else if (dayOfWeek === 5) { // Piątek
                    dyzurOdDoCell.innerText = '15:05-01:10';
                    iloscGodzinCell.innerText = "10h 5'";
                }

                previewDyzurOdDoCell.innerText = dyzurOdDoCell.innerText;
                previewIloscGodzinCell.innerText = iloscGodzinCell.innerText;

            } else {
                dyzurOdDoCell.innerText = '';
                iloscGodzinCell.innerText = '';
                previewDyzurOdDoCell.innerText = '';
                previewIloscGodzinCell.innerText = '';
            }
        }

        // 3. Po każdej zmianie przelicz sumy
        calculateAndDisplayTotals();
    });
}

function aktualizujWszystko() {
    aktualizujPodglad();
    updateCalendarView();
}

function aktualizujPodglad() {
    const imie = document.getElementById('imieNazwiskoInput').value;
    const miesiac = document.getElementById('miesiacInput').value;
    const miesiacText = miesiac ? (miesiac.replace(/\d+/g, '') + " " + (miesiac.match(/\d+/) ? miesiac.match(/\d+/)[0] + " r." : "")) : '.......................................................................';
    const imieText = imie || '........................................................................';

    document.getElementById('form-miesiacPodglad').innerText = miesiacText;
    document.getElementById('preview-miesiacPodglad').innerText = miesiacText;
    document.getElementById('form-imieNazwiskoPodglad').innerText = imieText;
    document.getElementById('preview-imieNazwiskoPodglad').innerText = imieText;
}

function updateCalendarView() {
    monThursDutyCounter = 0; // Resetuj licznik przy zmianie miesiąca

    const miesiacInput = document.getElementById('miesiacInput').value.toLowerCase();
    const parts = miesiacInput.split(' ');
    if (parts.length < 2) return;
    const monthName = parts[0];
    const year = parseInt(parts[1], 10);
    if (!polishMonths.hasOwnProperty(monthName) || isNaN(year)) return;

    const monthIndex = polishMonths[monthName];
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    for (let i = 1; i <= 31; i++) {
        const formRow = document.getElementById(`form-day-row-${i}`);
        const previewRow = document.getElementById(`preview-day-row-${i}`);
        const formCells = formRow.cells;
        const previewCells = previewRow.cells;

        [formRow, previewRow].forEach(row => row.classList.remove('day-disabled', 'weekend-row'));
        for (let j = 1; j < formCells.length; j++) {
            formCells[j].setAttribute('contenteditable', 'false');
            formCells[j].innerText = '';
            previewCells[j].innerText = '';
        }

        if (i > daysInMonth) {
            [formRow, previewRow].forEach(row => row.classList.add('day-disabled'));
            continue;
        }

        const dayOfWeek = new Date(year, monthIndex, i).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (isWeekend) {
            [formRow, previewRow].forEach(row => row.classList.add('weekend-row'));
            const code = (dayOfWeek === 6) ? 'W5' : '-';
            formCells[1].innerText = code;
            previewCells[1].innerText = code;
        } else {
            const editableColumns = [1, 2, 3, 4, 5, 6];
            editableColumns.forEach(colIndex => {
                formCells[colIndex].setAttribute('contenteditable', 'true');
            });
        }
    }

    calculateAndDisplayTotals(); // Zresetuj sumy po zmianie miesiąca
}

function generujPDF() {
    console.log("Rozpoczynam generowanie PDF...");
    const szablon = document.getElementById('podglad-pdf');
    
    html2canvas(szablon, { 
        scale: 2.5,
        useCORS: true 
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        
        const imie = document.getElementById('imieNazwiskoInput').value.replace(/ /g, '_') || "lekarz";
        const miesiac = document.getElementById('miesiacInput').value.replace(/ /g, '_') || "ewidencja";
        const fileName = `Ewidencja_${imie}_${miesiac}.pdf`;

        pdf.save(fileName);
        console.log("PDF wygenerowany!");
    });
}

/**
 * Przetwarza tekst w formacie "5h 5'" na łączną liczbę minut.
 * @param {string} timeString - Tekst do przetworzenia.
 * @returns {number} - Łączna liczba minut.
 */
function parseTimeToMinutes(timeString) {
    if (!timeString) return 0;
    
    let totalMinutes = 0;
    const hoursMatch = timeString.match(/(\d+)\s*h/);
    const minutesMatch = timeString.match(/(\d+)\s*'/);

    if (hoursMatch) {
        totalMinutes += parseInt(hoursMatch[1], 10) * 60;
    }
    if (minutesMatch) {
        totalMinutes += parseInt(minutesMatch[1], 10);
    }
    
    return totalMinutes;
}

/**
 * Formatuje łączną liczbę minut na tekst w formacie "Xh Y'".
 * @param {number} totalMinutes - Łączna liczba minut.
 * @returns {string} - Sformatowany czas.
 */
function formatMinutesToTime(totalMinutes) {
    if (totalMinutes === 0) return '';

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${minutes}'`;
}

/**
 * Główna funkcja, która liczy i wyświetla sumę godzin dyżuru.
 */
function calculateAndDisplayTotals() {
    const dutyHourCells = document.querySelectorAll('#formularz-edycji tbody td:nth-child(7)');
    let totalMinutes = 0;

    dutyHourCells.forEach(cell => {
        totalMinutes += parseTimeToMinutes(cell.innerText);
    });

    const formattedTotal = formatMinutesToTime(totalMinutes);

    // Aktualizuj sumę w obu tabelach
    document.querySelector('#form-total-row td:nth-child(7)').innerText = formattedTotal;
    document.querySelector('#preview-total-row td:nth-child(7)').innerText = formattedTotal;

    // Sprawdź, czy pokazać komunikat o błędzie
    const warningMessage = document.getElementById('warning-message');
    const limitInMinutes = (40 * 60) + 20;

    if (totalMinutes > limitInMinutes) {
        warningMessage.style.display = 'block';
    } else {
        warningMessage.style.display = 'none';
    }
}

/**
 * Dodaje obsługę zdarzeń do przycisków masowego wypełniania kodów pracy.
 */
function setupFillButtons() {
    const fillButtons = document.querySelectorAll('.fill-btn');
    fillButtons.forEach(button => {
        button.addEventListener('click', () => {
            const codeToFill = button.dataset.code;
            const codeCells = document.querySelectorAll('#formularz-edycji tbody td:nth-child(2)');

            codeCells.forEach(cell => {
                // Wypełnij tylko puste i edytowalne komórki
                if (cell.getAttribute('contenteditable') === 'true' && cell.innerText.trim() === '') {
                    cell.innerText = codeToFill;
                    
                    // Ręczna synchronizacja z podglądem
                    const row = cell.closest('tr');
                    const previewRowId = row.id.replace('form-', 'preview-');
                    const previewRow = document.getElementById(previewRowId);
                    if (previewRow) {
                        previewRow.cells[cell.cellIndex].innerText = codeToFill;
                    }
                    // WYWOŁAJ NOWĄ FUNKCJĘ do wypełnienia godzin
                    autoFillWorkHours(cell);
                }
            });

            // Po wypełnieniu przelicz sumy (jeśli kod to np. urlop)
            calculateAndDisplayTotals();
        });
    });
}

/**
 * Automatycznie wypełnia godziny pracy, jeśli kod pracy to "1A" lub "SZ".
 * @param {HTMLElement} formCell - Komórka z kodem pracy, która została zmieniona.
 */
function autoFillWorkHours(formCell) {
    const code = formCell.innerText.trim().toUpperCase();
    const parentRow = formCell.closest('tr');

    // Sprawdź, czy komórka jest edytowalna (aby unikać weekendów)
    if (formCell.getAttribute('contenteditable') !== 'true') {
        return;
    }

    if (code === '1A' || code === 'SZ') {
        const godzinyPracyCell = parentRow.cells[2];
        const iloscGodzinCell = parentRow.cells[3];

        // Wypełnij komórki
        godzinyPracyCell.innerText = '7:30-15:05';
        iloscGodzinCell.innerText = "7h 35'";

        // Ręcznie zsynchronizuj te dwie komórki z podglądem
        const previewRowId = parentRow.id.replace('form-', 'preview-');
        const previewRow = document.getElementById(previewRowId);
        if (previewRow) {
            previewRow.cells[2].innerText = godzinyPracyCell.innerText;
            previewRow.cells[3].innerText = iloscGodzinCell.innerText;
        }
    }
}

/**
 * Dodaje obsługę do przycisku czyszczenia danych.
 */
function setupClearButton() {
    const clearBtn = document.getElementById('clear-data-btn');
    clearBtn.addEventListener('click', () => {
        // Pytamy użytkownika o potwierdzenie
        const isConfirmed = confirm('Czy na pewno chcesz usunąć wszystkie wprowadzone dane z formularza?');
        
        if (isConfirmed) {
            // Czyścimy pole z imieniem i nazwiskiem
            document.getElementById('imieNazwiskoInput').value = '';
            // Uruchamiamy główną funkcję aktualizującą, która zresetuje tabele
            aktualizujWszystko();
            console.log("Dane zostały wyczyszczone.");
        }
    });
}