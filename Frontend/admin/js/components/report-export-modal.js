export class ReportExportModal {

    constructor({
        title = "Exportar reporte",
        filename = "reporte",
        reportType,
        exportFunction,
    }) {

        this.title = title;
        this.filename = filename;
        this.reportType = reportType;
        this.exportFunction = exportFunction;

        this.element = null;
    }

    open() {

        this.close();

        const overlay = document.createElement("div");

        overlay.className = "report-modal-overlay";

        overlay.innerHTML = `
            <div class="report-modal">

                <div class="report-modal-title">
                    ${this.title}
                </div>

                <div class="report-modal-description">
                    Seleccione el formato de exportación.
                </div>

                <div class="report-modal-actions">

                    <button
                        type="button"
                        class="report-btn report-btn-pdf"
                        data-format="pdf"
                    >
                        PDF
                    </button>

                    <button
                        type="button"
                        class="report-btn report-btn-excel"
                        data-format="excel"
                    >
                        Excel
                    </button>

                </div>

                <button
                    type="button"
                    class="report-btn-close"
                >
                    Cerrar
                </button>

            </div>
        `;

        document.body.appendChild(overlay);

        this.element = overlay;

        this.registerEvents();
    }

    registerEvents() {

        const btnClose =
            this.element.querySelector(
                ".report-btn-close"
            );

        btnClose.addEventListener(
            "click",
            () => this.close()
        );

        const buttons =
            this.element.querySelectorAll(
                "[data-format]"
            );

        buttons.forEach((button) => {

            button.addEventListener(
                "click",
                async (e) => {

                    e.preventDefault();

                    await this.download(
                        button.dataset.format,
                        button
                    );

                }
            );

        });
    }

    async download(format, button) {

        try {

            button.disabled = true;

            const response =
            await this.exportFunction(
                this.reportType,
                format
            );

            const blob = response.blob;;

            const url = window.URL.createObjectURL(blob);

            const link = document.createElement("a");

            link.href = url;

            const extension =format === "excel" ? "xlsx" : format;

            let filename = `${this.filename}.${extension}`;
            console.log("1")
            console.log(response);
            console.log("2")
            console.log(response.headers);
            console.log("3")
console.log(
    response.headers.get("Content-Disposition")
);
            const contentDisposition =
                response.headers.get(
                    "Content-Disposition"
                );

            if (contentDisposition) {

                const match =
                    contentDisposition.match(
                        /filename="?([^"]+)"?/
                    );

                if (match) {
                    filename = match[1];
                }
            }

            link.download = filename;
            
            document.body.appendChild(link);

            link.click();

            link.remove();

            window.URL.revokeObjectURL(url);

            this.close();

        } catch (error) {

            console.error(
                "Error al generar reporte:",
                error
            );

            alert(
                "No fue posible generar el reporte."
            );

        } finally {

            button.disabled = false;

        }
    }

    close() {

        if (this.element) {

            this.element.remove();

            this.element = null;

        }
    }
}
