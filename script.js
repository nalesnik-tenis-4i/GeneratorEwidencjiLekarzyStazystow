document.addEventListener('DOMContentLoaded', function() {
    window.jsPDF = window.jspdf.jsPDF;
    
    initializeMonth();
    setupSynchronization();
    setupFillButtons();
    setupClearButton();
    setupScreenSizeWarning();
});

const polishMonths = { "styczeń": 0, "luty": 1, "marzec": 2, "kwiecień": 3, "maj": 4, "czerwiec": 5, "lipiec": 6, "sierpień": 7, "wrzesień": 8, "październik": 9, "listopad": 10, "grudzień": 11 };
const polishMonthsTitleCase = [ "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień" ];

// Flaga do śledzenia, czy pokazano pop-up w tej sesji
let sessionAlertShown = false;

function initializeMonth() {
    const today = new Date();
    
    // Jeśli jest dzień od 1 do 5, ustaw poprzedni miesiąc
    if (today.getDate() <= 5) {
        today.setMonth(today.getMonth() - 1);
    }
    // W przeciwnym razie (od 6 dnia) pozostaje bieżący miesiąc

    const monthName = polishMonthsTitleCase[today.getMonth()];
    const year = today.getFullYear();
    document.getElementById('miesiacInput').value = `${monthName} ${year}`;
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

    // Nasłuchiwanie kliknięć do przełączania dyżurów
    formularz.addEventListener('click', (event) => {
        const clickedCell = event.target;
        if (clickedCell.tagName === 'TD' && clickedCell.cellIndex === 4 && clickedCell.getAttribute('contenteditable') === 'true') {
            const currentText = clickedCell.innerText.trim();
            clickedCell.innerText = currentText === 'D' ? '' : 'D';
            clickedCell.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    // Główna logika dla wpisywania danych
    formularz.addEventListener('input', (event) => {
        const editedCell = event.target;
        if (editedCell.tagName !== 'TD') return;

        const editedRow = editedCell.closest('tr');
        const cellIndex = editedCell.cellIndex;
        
        // Automatyczna zmiana na wielkie litery dla kodów
        if (cellIndex === 1 || cellIndex === 4) {
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const cursorPosition = range.startOffset;
            const originalText = editedCell.innerText;
            const upperCaseText = originalText.toUpperCase();

            if (originalText !== upperCaseText) {
                editedCell.innerText = upperCaseText;
                const textNode = editedCell.firstChild;
                if (textNode) {
                    const newRange = document.createRange();
                    const newCursorPosition = Math.min(cursorPosition, textNode.length);
                    newRange.setStart(textNode, newCursorPosition);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            }
        }

        // Synchronizacja edytowanej komórki do podglądu
        const previewRowId = editedRow.id.replace('form-', 'preview-');
        const previewRow = document.getElementById(previewRowId);
        if (previewRow) {
            previewRow.cells[cellIndex].innerText = editedCell.innerText;
        }
        
        // Uruchomienie automatyzacji dla kodów pracy
        if (cellIndex === 1) {
            autoFillWorkHours(editedCell);
            handleAbsenceCode(editedCell);
            // Zmiana kodu pracy (np. na urlop) może wpłynąć na długość poprzedzającego dyżuru
            recalculateAllDuties();
        }

        // Uruchomienie automatyzacji dla kodów dyżuru
        if (cellIndex === 4) {
            recalculateAllDuties();
        }

        // Przeliczenie sum po każdej zmianie
        calculateAndDisplayTotals();
    });
}

function recalculateAllDuties() {
    const shortDutyCells = [];

    // Krok 1: Przejdź przez cały miesiąc i ustaw długie dyżury oraz wyczyść komórki
    for (let i = 1; i <= 31; i++) {
        const row = document.getElementById(`form-day-row-${i}`);
        if (!row || row.classList.contains('day-disabled')) continue;

        const previewRow = document.getElementById(`preview-day-row-${i}`);
        const dutyCode = row.cells[4].innerText.trim().toUpperCase();
        const dyzurOdDoCell = row.cells[5];
        const iloscGodzinCell = row.cells[6];
        const previewDyzurOdDoCell = previewRow.cells[5];
        const previewIloscGodzinCell = previewRow.cells[6];

        if (dutyCode === 'D') {
            const nextDayRow = document.getElementById(`form-day-row-${i + 1}`);
            let isNextDayOff = false;
            if (nextDayRow && !nextDayRow.classList.contains('day-disabled')) {
                const nextDayCode = nextDayRow.cells[1].innerText.trim().toUpperCase();
                const dayOffTriggerCodes = new Set(['UUT', 'UM', 'UR', 'UW', 'UO', 'SW', 'WN', 'NZD', 'CW', 'OK', 'W5', 'WZN', 'WZŚ', '-']);
                if (dayOffTriggerCodes.has(nextDayCode)) {
                    isNextDayOff = true;
                }
            }

            if (isNextDayOff) {
                // To jest długi dyżur, ustawiamy go od razu
                dyzurOdDoCell.innerText = '15:05-01:10';
                iloscGodzinCell.innerText = "10h 5'";
                previewDyzurOdDoCell.innerText = dyzurOdDoCell.innerText;
                previewIloscGodzinCell.innerText = iloscGodzinCell.innerText;
            } else {
                // To jest krótki dyżur, dodajemy go do listy do późniejszego przetworzenia
                shortDutyCells.push({ dyzurOdDoCell, iloscGodzinCell, previewDyzurOdDoCell, previewIloscGodzinCell });
            }
        } else {
            // Jeśli w komórce nie ma 'D', upewniamy się, że pola godzin są puste
            dyzurOdDoCell.innerText = '';
            iloscGodzinCell.innerText = '';
            previewDyzurOdDoCell.innerText = '';
            previewIloscGodzinCell.innerText = '';
        }
    }

    // Krok 2: Przejdź przez listę krótkich dyżurów i przypisz im wartości naprzemiennie
    shortDutyCells.forEach((cells, index) => {
        let odDo, ilosc;
        if (index % 2 === 0) { // Pierwszy, trzeci, piąty...
            odDo = '15:05-20:10';
            ilosc = "5h 5'";
        } else { // Drugi, czwarty, szósty...
            odDo = '15:05-20:05';
            ilosc = '5h';
        }
        cells.dyzurOdDoCell.innerText = odDo;
        cells.iloscGodzinCell.innerText = ilosc;
        cells.previewDyzurOdDoCell.innerText = odDo;
        cells.previewIloscGodzinCell.innerText = ilosc;
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
            formCells[j].classList.remove('cell-locked-by-code');
            previewCells[j].classList.remove('cell-locked-by-code');
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
            formCells[1].setAttribute('contenteditable', 'true');
            const editableColumns = [2, 3, 4, 5, 6];
            editableColumns.forEach(colIndex => {
                formCells[colIndex].setAttribute('contenteditable', 'true');
            });
        }
    }

    calculateAndDisplayTotals();
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

function formatMinutesToTime(totalMinutes) {
    if (totalMinutes === 0) return '';

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${minutes}'`;
}

function calculateAndDisplayTotals() {
    const dutyHourCells = document.querySelectorAll('#formularz-edycji tbody td:nth-child(7)');
    let totalMinutes = 0;

    dutyHourCells.forEach(cell => {
        totalMinutes += parseTimeToMinutes(cell.innerText);
    });

    const formattedTotal = formatMinutesToTime(totalMinutes);

    document.querySelector('#form-total-row td:nth-child(7)').innerText = formattedTotal;
    document.querySelector('#preview-total-row td:nth-child(7)').innerText = formattedTotal;

    const warningMessage = document.getElementById('warning-message');
    const limitInMinutes = (40 * 60) + 20;

    if (totalMinutes > limitInMinutes) {
        warningMessage.style.display = 'block';

        if (!sessionAlertShown) {
            alert('Uwaga! Przekroczono normę godzin dyżuru w miesiącu (40h 20\').');
            sessionAlertShown = true;
        }
    } else {
        warningMessage.style.display = 'none';
    }
}

function setupFillButtons() {
    const fillButtons = document.querySelectorAll('.fill-btn');
    fillButtons.forEach(button => {
        button.addEventListener('click', () => {
            const codeToFill = button.dataset.code;
            const codeCells = document.querySelectorAll('#formularz-edycji tbody td:nth-child(2)');

            codeCells.forEach(cell => {
                if (cell.getAttribute('contenteditable') === 'true' && cell.innerText.trim() === '') {
                    cell.innerText = codeToFill;
                    
                    const row = cell.closest('tr');
                    const previewRowId = row.id.replace('form-', 'preview-');
                    const previewRow = document.getElementById(previewRowId);
                    if (previewRow) {
                        previewRow.cells[cell.cellIndex].innerText = codeToFill;
                    }
                    autoFillWorkHours(cell);
                    handleAbsenceCode(cell);
                }
            });

            calculateAndDisplayTotals();
        });
    });
}

function autoFillWorkHours(formCell) {
    const code = formCell.innerText.trim().toUpperCase();
    const parentRow = formCell.closest('tr');

    if (formCell.getAttribute('contenteditable') !== 'true') {
        return;
    }

    if (code === '1A' || code === 'SZ') {
        const godzinyPracyCell = parentRow.cells[2];
        const iloscGodzinCell = parentRow.cells[3];

        godzinyPracyCell.innerText = '7:30-15:05';
        iloscGodzinCell.innerText = "7h 35'";

        const previewRowId = parentRow.id.replace('form-', 'preview-');
        const previewRow = document.getElementById(previewRowId);
        if (previewRow) {
            previewRow.cells[2].innerText = godzinyPracyCell.innerText;
            previewRow.cells[3].innerText = iloscGodzinCell.innerText;
        }
    }
}

function handleAbsenceCode(codeCell) {
    const absenceCodes = new Set(['UUT', 'UM', 'UR', 'UW', 'ZL4', 'UO', 'SW', 'WN', 'NZD', 'ZP', 'ZN', 'CW', 'OK', 'IN', 'W5', 'WZN', 'WZŚ']);
    const code = codeCell.innerText.trim().toUpperCase();
    const isAbsence = absenceCodes.has(code);

    const parentRow = codeCell.closest('tr');
    const previewRowId = parentRow.id.replace('form-', 'preview-');
    const previewRow = document.getElementById(previewRowId);

    if (!previewRow || parentRow.classList.contains('weekend-row')) {
        return;
    }
    
    for (let i = 2; i < parentRow.cells.length; i++) {
        const formCell = parentRow.cells[i];
        const previewCell = previewRow.cells[i];

        if (isAbsence) {
            formCell.innerText = '';
            previewCell.innerText = '';
            formCell.setAttribute('contenteditable', 'false');
            formCell.classList.add('cell-locked-by-code');
            previewCell.classList.add('cell-locked-by-code');
        } else {
            formCell.classList.remove('cell-locked-by-code');
            previewCell.classList.remove('cell-locked-by-code');
            const editableColumns = [2, 3, 4, 5, 6];
            if (editableColumns.includes(i)) {
                formCell.setAttribute('contenteditable', 'true');
            }
        }
    }
}

function setupClearButton() {
    const clearBtn = document.getElementById('clear-data-btn');
    clearBtn.addEventListener('click', () => {
        const isConfirmed = confirm('Czy na pewno chcesz usunąć wszystkie wprowadzone dane z formularza?');
        
        if (isConfirmed) {
            document.getElementById('imieNazwiskoInput').value = '';
            aktualizujWszystko();
            
            sessionAlertShown = false;
            console.log("Dane zostały wyczyszczone, a alert o limicie godzin zresetowany.");
        }
    });
}

function setupScreenSizeWarning() {
    const overlay = document.getElementById('size-warning-overlay');
    const closeButton = document.getElementById('close-size-warning');
    const popupTitle = document.querySelector('#size-warning-popup h2');
    const messageElement = document.getElementById('size-warning-message');
    const appContainer = document.getElementById('app-container');

    function checkScreenSize() {
        const screenWidth = window.innerWidth;
        appContainer.style.zoom = '1';

        if (screenWidth <= 1600) {
            let message = '';
            let title = '';
            let titleColor = '';
            
            if (screenWidth > 1380) {
                appContainer.style.zoom = '0.9';
                title = 'Dopasowanie ekranu';
                titleColor = '#007bff';
                message = "Dla lepszego dopasowania, widok został automatycznie przeskalowany (x0.9).<br><br>Aby korzystać z aplikacji w pełnym rozmiarze, zalecamy ekran o szerokości powyżej 1600px.";
            }
            else if (screenWidth >= 1300) {
                appContainer.style.zoom = '0.8';
                title = 'Dopasowanie ekranu';
                titleColor = '#007bff';
                message = "Dla lepszego dopasowania, widok został automatycznie przeskalowany (x0.8).<br><br>Aby korzystać z aplikacji w pełnym rozmiarze, zalecamy ekran o szerokości powyżej 1600px.";
            }
            else {
                title = 'Uwaga!';
                titleColor = '#d9534f';
                message = "Aplikacja może działać niepoprawnie na tak małym ekranie. Wiele elementów może być niewidocznych.<br><br>Zdecydowanie zalecamy skorzystanie z większego monitora.";
            }
            
            if (!sessionStorage.getItem('sizeWarningDismissed')) {
                popupTitle.innerText = title;
                popupTitle.style.color = titleColor;
                messageElement.innerHTML = message;
                overlay.classList.remove('hidden');
            }
        }
        else {
            overlay.classList.add('hidden');
        }
    }

    closeButton.addEventListener('click', () => {
        overlay.classList.add('hidden');
        sessionStorage.setItem('sizeWarningDismissed', 'true');
    });

    window.addEventListener('resize', checkScreenSize);
    checkScreenSize();
}
