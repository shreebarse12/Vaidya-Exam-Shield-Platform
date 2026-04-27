# Importing all models here ensures SQLAlchemy's Base knows about
# every table before `Base.metadata.create_all()` is called in main.py.
# Without these imports, tables simply won't be created.

from app.models.base import UUIDMixin, TimestampMixin  # noqa
from app.models.tenant import Tenant                    # noqa
from app.models.user import User                        # noqa
from app.models.question import Question                # noqa