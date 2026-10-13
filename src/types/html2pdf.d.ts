declare module 'html2pdf.js' {
  export interface Html2PdfOptions {
    margin?: number | number[]
    filename?: string

    image?: {
      type?: string
      quality?: number
    }

    html2canvas?: Record<string, unknown>

    jsPDF?: {
      unit?: string
      format?: string | [number, number]
      orientation?: 'portrait' | 'landscape' | string
      compress?: boolean
      [key: string]: unknown
    }

    pagebreak?: {
      mode?: string | string[]
      before?: string | string[]
      after?: string | string[]
      avoid?: string | string[]
    }

    enableLinks?: boolean

    [key: string]: unknown
  }

  export interface Html2PdfInstance {
    set(
      options: Html2PdfOptions,
    ): Html2PdfInstance

    from(
      element: HTMLElement | string,
    ): Html2PdfInstance

    save(
      filename?: string,
    ): Promise<void>

    output(
      type?: string,
      options?: unknown,
    ): Promise<unknown>

    then(
      onFulfilled?: (
        value: unknown,
      ) => unknown,
    ): Html2PdfInstance

    toPdf(): Html2PdfInstance

    get(
      type: string,
    ): Html2PdfInstance
  }

  function html2pdf(): Html2PdfInstance

  function html2pdf(
    element: HTMLElement,
    options?: Html2PdfOptions,
  ): Promise<void>

  export default html2pdf
}