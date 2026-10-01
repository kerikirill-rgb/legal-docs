import logging
import sys


def setup_logging(level: str = "INFO") -> None:
    """Структурированные технические логи без пользовательских текстов и секретов."""
    root = logging.getLogger()
    if root.handlers:
        root.setLevel(level.upper())
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )
    )
    root.addHandler(handler)
    root.setLevel(level.upper())

    # Шумные библиотеки
    logging.getLogger("aiohttp").setLevel(logging.WARNING)
    logging.getLogger("aiogram").setLevel(logging.INFO)
