import structlog

logger = structlog.get_logger()


def configure_logging(level: str = "INFO") -> None:
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(_level_int(level)),
        cache_logger_on_first_use=True,
    )


def _level_int(level: str) -> int:
    import logging

    return getattr(logging, level.upper(), logging.INFO)
