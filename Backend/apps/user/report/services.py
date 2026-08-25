from apps.base.reportes.services.services import BaseReportService
from apps.user.models import User


class UsuariosReportService(BaseReportService):

    # ------------------------------------------------------------------
    # Queryset base: usuarios no eliminados lógicamente (is_deleted=False)
    # ------------------------------------------------------------------
    @staticmethod
    def _get_qs():
        return (
            User.objects
            .filter(is_deleted=False)
        )


    # ------------------------------------------------------------------
    # Reporte: todos los usuarios activos del sistema (single_table)
    # ------------------------------------------------------------------
    @classmethod
    def usuarios(cls, filters):
        qs = cls._get_qs()

        # Filtros opcionales
        is_active = filters.get("activo")
        if is_active is not None:
            qs = qs.filter(is_active=is_active in ("true", "True", "1"))

        is_staff = filters.get("es_administrador")
        if is_staff is not None:
            qs = qs.filter(is_staff=is_staff in ("true", "True", "1"))

        is_superuser = filters.get("es_superusuario")
        if is_superuser is not None:
            qs = qs.filter(is_superuser=is_superuser in ("true", "True", "1"))

        columns = [
            "Usuario",
            "Nombre completo",
            "Correo",
            "Es administrador",
            "Es superusuario",
            "Estado",
            "Último acceso",
            "Fecha de registro",
        ]

        rows = [
            [
                u.username,
                u.get_full_name() or "—",
                u.email or "—",
                "Sí" if u.is_staff else "No",
                "Sí" if u.is_superuser else "No",
                "Activo" if u.is_active else "Inactivo",
                u.last_login.strftime("%d/%m/%Y %H:%M") if u.last_login else "Nunca",
                u.date_joined.strftime("%d/%m/%Y") if u.date_joined else "—",
            ]
            for u in qs
        ]

        return cls.build_response(
            filename="reporte_usuarios",
            columns=columns,
            rows=rows,
        )

    # ------------------------------------------------------------------
    # Reporte: solo administradores (is_staff=True) (Existente, compatible)
    # ------------------------------------------------------------------
    @classmethod
    def administradores(cls, filters):
        qs = cls._get_qs().filter(is_staff=True)

        columns = [
            "Usuario",
            "Nombre completo",
            "Correo",
            "Es superusuario",
            "Estado",
            "Último acceso",
            "Fecha de registro",
        ]

        rows = [
            [
                u.username,
                u.get_full_name() or "—",
                u.email or "—",
                "Sí" if u.is_superuser else "No",
                "Activo" if u.is_active else "Inactivo",
                u.last_login.strftime("%d/%m/%Y %H:%M") if u.last_login else "Nunca",
                u.date_joined.strftime("%d/%m/%Y") if u.date_joined else "—",
            ]
            for u in qs
        ]

        return cls.build_response(
            filename="reporte_administradores",
            columns=columns,
            rows=rows,
        )

    # ------------------------------------------------------------------
    # Reporte: usuario detalle por ID (header_table)
    # ------------------------------------------------------------------
    @classmethod
    def usuario_detalle(cls, filters):
        pk = filters.get("id") or filters.get("pk")
        if not pk:
            raise ValueError("El ID del usuario es requerido.")

        u = cls._get_qs().get(pk=pk)

        header_table = [
            ("Usuario", u.username),
            ("Nombre completo", u.get_full_name() or "—"),
            ("Correo", u.email or "—"),
            ("Es administrador", "Sí" if u.is_staff else "No"),
            ("Es superusuario", "Sí" if u.is_superuser else "No"),
            ("Estado", "Activo" if u.is_active else "Inactivo"),
            ("Último acceso", u.last_login.strftime("%d/%m/%Y %H:%M") if u.last_login else "Nunca"),
            ("Fecha de registro", u.date_joined.strftime("%d/%m/%Y") if u.date_joined else "—"),
        ]


        return {
            "filename": f"detalle_usuario_{pk}",
            "header_table": header_table,
        }
