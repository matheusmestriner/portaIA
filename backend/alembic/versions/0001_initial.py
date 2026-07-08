from alembic import op
import sqlalchemy as sa
revision='0001_initial'; down_revision=None; branch_labels=None; depends_on=None
def upgrade():
    bind=op.get_bind()
    from app.models.base import Base
    from app.models import domain
    Base.metadata.create_all(bind)
def downgrade():
    bind=op.get_bind()
    from app.models.base import Base
    Base.metadata.drop_all(bind)
