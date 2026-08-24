class ReportError(Exception):
    pass


class InvalidReportFormatError(ReportError):
    pass


class ReportGenerationError(ReportError):
    pass