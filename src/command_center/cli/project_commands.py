"""
CLI commands for project management
"""
from rich.console import Console
from rich.table import Table

from command_center.utils.project_metadata import (
    list_all_projects,
    update_project_metadata
)


def list_projects_command():
    """
    Display all discovered projects in a rich table.

    Shows project ID, name, absolute path, and last seen date.
    """
    console = Console()
    projects = list_all_projects()

    if not projects:
        console.print("[yellow]No projects discovered yet. Run a scan first:[/yellow]")
        console.print("[dim]  command-center[/dim]")
        return

    table = Table(title="Discovered Projects", show_lines=True)
    table.add_column("Project ID", style="cyan", no_wrap=True)
    table.add_column("Name", style="green")
    table.add_column("Absolute Path", style="blue")
    table.add_column("Last Seen", style="yellow")

    for proj in projects:
        # Format last_seen to show just date (YYYY-MM-DD)
        last_seen_date = proj.get('last_seen', '')[:10] if proj.get('last_seen') else 'N/A'

        table.add_row(
            proj['project_id'],
            proj.get('name') or "[dim]<not set>[/dim]",
            proj.get('absolute_path') or "[dim]N/A[/dim]",
            last_seen_date
        )

    console.print(table)
    console.print(f"\n[dim]Total: {len(projects)} projects[/dim]")


def update_project_command(project_id: str, name: str = None, description: str = None):
    """
    Update project metadata via CLI.

    Args:
        project_id: Project identifier
        name: New display name (optional)
        description: New description (optional)
    """
    console = Console()

    try:
        update_project_metadata(project_id, name=name, description=description)

        console.print(f"[green]✓[/green] Updated project: [cyan]{project_id}[/cyan]")

        if name:
            console.print(f"  Name: [green]{name}[/green]")
        if description:
            console.print(f"  Description: [green]{description}[/green]")

    except ValueError as e:
        console.print(f"[red]Error:[/red] {e}")
        console.print("[dim]Tip: Run 'command-center' first to discover projects[/dim]")
