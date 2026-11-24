/* Wrapper de SweetAlert2 con el tema oscuro de la app. */

import Swal, { type SweetAlertIcon, type SweetAlertOptions, type SweetAlertResult } from 'sweetalert2';

const THEME = { background: '#2f3136', color: '#dcddde' } as const;

interface ConfirmOptions {
    title: string;
    text?: string;
    html?: string;
    icon?: SweetAlertIcon;
    confirmText?: string;
    cancelText?: string;
    color?: string;
}

export const Dialog = {
    fire(options: SweetAlertOptions): Promise<SweetAlertResult> {
        return Swal.fire({ ...THEME, ...options });
    },

    async confirm({ title, text, html, icon = 'question', confirmText = 'Aceptar', cancelText = 'Cancelar', color = '#c0392b' }: ConfirmOptions): Promise<boolean> {
        const res = await this.fire({
            icon, title, text, html,
            showCancelButton: true,
            confirmButtonText: confirmText,
            cancelButtonText: cancelText,
            confirmButtonColor: color
        });
        return res.isConfirmed;
    },

    info(title: string, text?: string, icon: SweetAlertIcon = 'info'): Promise<SweetAlertResult> {
        return this.fire({ icon, title, text, confirmButtonColor: '#5865f2' });
    },

    isOpen(): boolean {
        return !!document.querySelector('.swal2-container');
    }
};
