from sqlalchemy import create_engine, Column, String, Boolean, ForeignKey, Integer, Table
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

DATABASE_URL = "postgresql+psycopg://mashrafimahmudrafi@localhost:5432/mydb"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Association table for Group & Note
group_notes = Table(
    "group_notes",
    Base.metadata,
    Column("group_id", String, ForeignKey("groups.group_id", ondelete="CASCADE"), primary_key=True),
    Column("note_id", String, ForeignKey("notes.note_id", ondelete="CASCADE"), primary_key=True),
)


class DBUser(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True, index=True)
    user_mail = Column(String, unique=True, index=True, nullable=False)
    user_pass = Column(String, nullable=False)

    notes = relationship("DBNote", back_populates="user", cascade="all, delete-orphan")
    groups = relationship("DBGroup", back_populates="user", cascade="all, delete-orphan")


class DBNote(Base):
    __tablename__ = "notes"

    note_id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    note_title = Column(String(100), nullable=False)
    note_body = Column(String(1000), nullable=False)
    bg_color = Column(String(7), default="#FFFFFF")
    is_pinned = Column(Boolean, default=False)

    user = relationship("DBUser", back_populates="notes")
    images = relationship("DBPicture", back_populates="note", cascade="all, delete-orphan")
    voices = relationship("DBVoice", back_populates="note", cascade="all, delete-orphan")
    groups = relationship("DBGroup", secondary=group_notes, back_populates="notes")


class DBGroup(Base):
    __tablename__ = "groups"

    group_id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String(1000), default="")

    user = relationship("DBUser", back_populates="groups")
    notes = relationship("DBNote", secondary=group_notes, back_populates="groups")


class DBPicture(Base):
    __tablename__ = "pictures"

    picture_id = Column(String, primary_key=True, index=True)
    note_id = Column(String, ForeignKey("notes.note_id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    picture_url = Column(String, nullable=False)
    file_hash = Column(String, nullable=True)
    index = Column(Integer, nullable=False)

    note = relationship("DBNote", back_populates="images")


class DBVoice(Base):
    __tablename__ = "voices"

    voice_id = Column(String, primary_key=True, index=True)
    note_id = Column(String, ForeignKey("notes.note_id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    voice_url = Column(String, nullable=False)
    index = Column(Integer, nullable=False)

    note = relationship("DBNote", back_populates="voices")