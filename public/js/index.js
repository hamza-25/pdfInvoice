    document.addEventListener('DOMContentLoaded', function() {
        const form = document.getElementById('invoice-form');
        const addItemBtn = document.getElementById('add-item-btn');
        const invoiceItemsContainer = document.getElementById('invoice-items');
        const submitBtn = document.getElementById('submit-btn');

        // --- Core Functions ---
        const addNewItem = () => {
            const itemRow = document.createElement('tr');
            itemRow.classList.add('item-row');
            itemRow.innerHTML = `
                <td class="p-2"><input type="text" placeholder="Item description" class="description w-full p-2 rounded-md invoice-input"></td>
                <td class="p-2"><input type="number" value="1" min="1" class="quantity w-full p-2 text-center rounded-md invoice-input"></td>
                <td class="p-2"><input type="number" value="0.00" step="0.01" class="price w-full p-2 text-center rounded-md invoice-input"></td>
                <td class="p-2 text-center">
                    <button class="remove-item-btn text-slate-400 hover:text-red-500 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            `;
            invoiceItemsContainer.appendChild(itemRow);
            updateTotals(); // Call updateTotals after adding
        };

        const updateTotals = () => {
            let subtotal = 0;
            document.querySelectorAll('.item-row').forEach(row => {
                const qty = parseFloat(row.querySelector('.quantity').value) || 0;
                const price = parseFloat(row.querySelector('.price').value) || 0;
                subtotal += qty * price;
            });

            const taxRate = parseFloat(document.getElementById('tax-rate').value) || 0;
            const taxAmount = subtotal * (taxRate / 100);
            const totalAmount = subtotal + taxAmount;

            document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
            document.getElementById('total-amount').textContent = `$${totalAmount.toFixed(2)}`;
        };

        // --- Event Listeners ---
        form.addEventListener('input', (e) => {
             // Update totals on any input change within the form
            if(e.target.matches('.quantity, .price, #tax-rate')) {
                updateTotals();
            }
        });
        
        addItemBtn.addEventListener('click', addNewItem);

        invoiceItemsContainer.addEventListener('click', (e) => {
            if (e.target.closest('.remove-item-btn')) {
                e.target.closest('.item-row').remove();
                updateTotals(); // Call updateTotals after removing
            }
        });

        submitBtn.addEventListener('click', () => {
            submitBtn.textContent = 'Processing...';
            submitBtn.disabled = true;

            const invoiceData = {
                documentType: document.getElementById('invoice-type').value,
                company: { name: document.getElementById('company-name').value, address: document.getElementById('company-address').value },
                client: { name: document.getElementById('client-name').value, address: document.getElementById('client-address').value },
                number: document.getElementById('invoice-number').value,
                issueDate: document.getElementById('invoice-date').value,
                dueDate: document.getElementById('due-date').value,
                items: [],
                paymentType: document.getElementById('payment-type').value,
                notes: document.getElementById('notes').value,
                taxRate: parseFloat(document.getElementById('tax-rate').value) || 0,
                subtotal: 0,
                total: 0,
            };

            let subtotal = 0;
            document.querySelectorAll('.item-row').forEach(row => {
                const description = row.querySelector('.description').value;
                const quantity = parseFloat(row.querySelector('.quantity').value) || 0;
                const price = parseFloat(row.querySelector('.price').value) || 0;
                invoiceData.items.push({ description, quantity, price });
                subtotal += quantity * price;
            });

            invoiceData.subtotal = subtotal;
            invoiceData.total = subtotal * (1 + invoiceData.taxRate / 100);

            console.log("--- Document Data for Backend ---");
            console.log(JSON.stringify(invoiceData, null, 2));

            const notification = document.getElementById('notification-toast');
            notification.classList.remove('opacity-0', '-translate-y-2');
            notification.classList.add('opacity-100', 'translate-y-0');

            setTimeout(() => {
                notification.classList.remove('opacity-100', 'translate-y-0');
                notification.classList.add('opacity-0', '-translate-y-2');
                submitBtn.textContent = 'Submit for Processing';
                submitBtn.disabled = false;
            }, 3000);
        });

        // --- Initial Setup ---
        addNewItem();
        document.getElementById('invoice-date').valueAsDate = new Date();
        updateTotals();
    });