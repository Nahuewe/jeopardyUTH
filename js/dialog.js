/* ================================
   DIALOG
   Wrapper de SweetAlert2 con el tema oscuro de la app
================================ */

const THEME = { background: '#2f3136', color: '#dcddde' };

export const Dialog = {
    fire(options) {
        return Swal.fire({ ...THEME, ...options });
    },

    async confirm({ title, text, html, icon = 'question', confirmText = 'Aceptar', cancelText = 'Cancelar', color = '#c0392b' }) {
        const res = await this.fire({
            icon, title, text, html,
            showCancelButton: true,
            confirmButtonText: confirmText,
            cancelButtonText: cancelText,
            confirmButtonColor: color
        });
        return res.isConfirmed;
    },

    info(title, text, icon = 'info') {
        return this.fire({ icon, title, text, confirmButtonColor: '#5865f2' });
    },

    isOpen() {
        return !!document.querySelector('.swal2-container');
    }
};
