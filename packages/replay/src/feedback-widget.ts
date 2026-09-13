import type { FeedbackModalOptions } from "./types";

export class HaloFeedbackWidget {
    private container: HTMLElement | null = null;
    private options: FeedbackModalOptions;
    private onSubmitHandler: (feedback: { name?: string; email?: string; comments: string }) => Promise<void>;

    constructor(
        options: FeedbackModalOptions = {},
        onSubmit: (feedback: { name?: string; email?: string; comments: string }) => Promise<void>
    ) {
        this.options = options;
        this.onSubmitHandler = onSubmit;
    }

    public open(): void {
        if (typeof document === "undefined" || this.container) return;

        const overlay = document.createElement("div");
        overlay.id = "halo-feedback-modal-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "halo-feedback-title");
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(4px);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 16px;
            box-sizing: border-box;
        `;

        const modal = document.createElement("div");
        modal.style.cssText = `
            background: #0d1117;
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            width: 100%;
            max-width: 440px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            color: #e6edf3;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

        const header = document.createElement("div");
        header.style.cssText = `
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;

        const titleBox = document.createElement("div");
        const titleEl = document.createElement("h3");
        titleEl.id = "halo-feedback-title";
        titleEl.innerText = this.options.title || "Report an Issue / Feedback";
        titleEl.style.cssText = "margin: 0; font-size: 15px; font-weight: 600; color: #fff;";

        const subtitleEl = document.createElement("p");
        subtitleEl.innerText = this.options.subtitle || "Tell us what happened so our team can resolve it.";
        subtitleEl.style.cssText = "margin: 4px 0 0; font-size: 12px; color: #8b949e;";
        titleBox.appendChild(titleEl);
        titleBox.appendChild(subtitleEl);

        const closeBtn = document.createElement("button");
        closeBtn.innerHTML = "&times;";
        closeBtn.setAttribute("aria-label", "Close feedback dialog");
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: #8b949e;
            font-size: 20px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
        `;
        closeBtn.onclick = () => this.close();

        header.appendChild(titleBox);
        header.appendChild(closeBtn);

        const form = document.createElement("form");
        form.style.cssText = "padding: 20px; display: flex; flex-direction: column; gap: 14px;";

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.placeholder = this.options.namePlaceholder || "Your name (optional)";
        nameInput.value = this.options.defaultName || "";
        nameInput.id = "halo-feedback-name";
        nameInput.style.cssText = `
            background: #161b22;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 6px;
            padding: 9px 12px;
            color: #fff;
            font-size: 13px;
            outline: none;
        `;

        const emailInput = document.createElement("input");
        emailInput.type = "email";
        emailInput.placeholder = this.options.emailPlaceholder || "Your email (optional)";
        emailInput.value = this.options.defaultEmail || "";
        emailInput.id = "halo-feedback-email";
        emailInput.style.cssText = `
            background: #161b22;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 6px;
            padding: 9px 12px;
            color: #fff;
            font-size: 13px;
            outline: none;
        `;

        const commentsTextarea = document.createElement("textarea");
        commentsTextarea.rows = 4;
        commentsTextarea.placeholder = this.options.commentsPlaceholder || "Describe what went wrong or your feedback...";
        commentsTextarea.required = true;
        commentsTextarea.id = "halo-feedback-comments";
        commentsTextarea.style.cssText = `
            background: #161b22;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 6px;
            padding: 9px 12px;
            color: #fff;
            font-size: 13px;
            outline: none;
            resize: vertical;
        `;

        const errorMsg = document.createElement("div");
        errorMsg.id = "halo-feedback-error";
        errorMsg.style.cssText = "color: #f85149; font-size: 12px; display: none;";

        const actions = document.createElement("div");
        actions.style.cssText = "display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.innerText = this.options.cancelButtonText || "Cancel";
        cancelBtn.style.cssText = `
            background: #21262d;
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: #c9d1d9;
            padding: 8px 14px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
        `;
        cancelBtn.onclick = () => this.close();

        const submitBtn = document.createElement("button");
        submitBtn.type = "submit";
        submitBtn.id = "halo-feedback-submit-btn";
        submitBtn.innerText = this.options.submitButtonText || "Send Feedback";
        submitBtn.style.cssText = `
            background: #238636;
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #fff;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
        `;

        actions.appendChild(cancelBtn);
        actions.appendChild(submitBtn);

        form.appendChild(nameInput);
        form.appendChild(emailInput);
        form.appendChild(commentsTextarea);
        form.appendChild(errorMsg);
        form.appendChild(actions);

        form.onsubmit = async (e) => {
            e.preventDefault();
            const comments = commentsTextarea.value.trim();
            if (!comments) {
                errorMsg.innerText = "Please enter your comments.";
                errorMsg.style.display = "block";
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerText = "Submitting...";

            try {
                const feedbackData = {
                    name: nameInput.value.trim() || undefined,
                    email: emailInput.value.trim() || undefined,
                    comments,
                };

                await this.onSubmitHandler(feedbackData);

                if (typeof this.options.onSubmit === "function") {
                    await this.options.onSubmit(feedbackData);
                }

                this.close();
            } catch (err: any) {
                console.error("[Halo Replay] Failed to submit user feedback:", err);
                errorMsg.innerText = "Failed to send feedback. Please try again.";
                errorMsg.style.display = "block";
                submitBtn.disabled = false;
                submitBtn.innerText = this.options.submitButtonText || "Send Feedback";
            }
        };

        modal.appendChild(header);
        modal.appendChild(form);
        overlay.appendChild(modal);

        document.body.appendChild(overlay);
        this.container = overlay;
        commentsTextarea.focus();
    }

    public close(): void {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
            this.container = null;
        }
        if (typeof this.options.onClose === "function") {
            this.options.onClose();
        }
    }
}
