# Date Range Filter - User Guide

## Quick Start

### How to Use Date Range Filter

1. **Navigate to Task Management**
   - Go to the Task Management page in your workflow system

2. **Locate the Date Range Picker**
   - In the filter bar, you'll see two date input fields labeled "Start date" and "End date"
   - These appear after the "Due Date" filter

3. **Select Your Date Range**
   - Click on the "Start date" field and select the beginning date (YYYY-MM-DD)
   - Click on the "End date" field and select the ending date (YYYY-MM-DD)
   - The fields will highlight in blue when active

4. **View Active Filter**
   - A filter chip will appear below the filter bar showing: "Date Range: YYYY-MM-DD to YYYY-MM-DD"
   - This confirms your date range is active

5. **Export with Date Range**
   - Click the "Export" button
   - Select "Export Filtered" to download only tasks within your date range
   - The Excel file will contain all 6 sheets filtered by your date range

### Clearing the Date Range Filter

**Option 1: Click the X on the filter chip**
- Find the "Date Range: ..." chip below the filter bar
- Click the X button to remove it
- Both start and end dates will be cleared

**Option 2: Clear individual dates**
- Click on either date field and clear it
- The filter will update automatically

**Option 3: Click Reset**
- Click the "Reset" button to clear all filters at once

## Combining Filters

The date range filter works seamlessly with other filters:

```
Example: Export tasks assigned to "John" with "In Progress" status 
         between January 1 and May 31, 2026

1. Select Status: In Progress
2. Select Assignee: John
3. Select Date Range: 2026-01-01 to 2026-05-31
4. Click Export → Export Filtered
```

## Filter Combinations

| Scenario | Filters | Result |
|----------|---------|--------|
| Date range only | Start: 2026-01-01, End: 2026-05-31 | All tasks with start_date >= 2026-01-01 AND end_date <= 2026-05-31 |
| Date + Status | Date range + Status: Completed | Completed tasks within date range |
| Date + Assignee | Date range + Assignee: John | Tasks assigned to John within date range |
| Date + Priority | Date range + Priority: High | High priority tasks within date range |
| All filters | Date + Status + Assignee + Priority | Tasks matching all criteria |

## What Gets Exported

When you export with a date range filter, all 6 sheets are filtered:

1. **Task Summary** - Main task data filtered by date range
2. **Remarks** - Comments/remarks for filtered tasks
3. **Task History** - Audit log for filtered tasks
4. **Assignee Summary** - Statistics aggregated for filtered tasks
5. **Stage Summary** - Stage statistics for filtered tasks

## Date Range Logic

- **Start Date**: Filters tasks where `task.start_date >= selected_start_date`
- **End Date**: Filters tasks where `task.end_date <= selected_end_date`
- **Both Dates**: Tasks must satisfy BOTH conditions

### Examples

| Start Date | End Date | Includes |
|-----------|----------|----------|
| 2026-01-01 | 2026-05-31 | Tasks starting on/after Jan 1 AND ending on/before May 31 |
| 2026-01-01 | (empty) | Tasks starting on/after Jan 1 (no end date limit) |
| (empty) | 2026-05-31 | Tasks ending on/before May 31 (no start date limit) |

## Tips & Tricks

### Tip 1: Partial Date Ranges
You don't need to fill both dates:
- **Start date only**: Shows all tasks starting from that date onwards
- **End date only**: Shows all tasks ending up to that date

### Tip 2: Combine with Search
Use the search box + date range for powerful filtering:
- Search: "Design"
- Date Range: 2026-01-01 to 2026-05-31
- Result: All tasks with "Design" in name/description within the date range

### Tip 3: Export Multiple Formats
- **Export All**: Ignores date range, exports everything
- **Export Filtered**: Applies date range + all other filters
- **Export Selected**: Exports only checked tasks (date range not applied)

### Tip 4: Filter Chip Management
- Hover over filter chips to see the full filter details
- Click X to remove individual filters
- Click "Reset" to clear everything at once

## Troubleshooting

### Issue: Date range filter not appearing
**Solution**: Refresh the page or clear browser cache

### Issue: Export includes tasks outside date range
**Solution**: 
1. Check that the date range chip is showing below the filter bar
2. Verify you selected "Export Filtered" (not "Export All")
3. Ensure dates are in YYYY-MM-DD format

### Issue: No tasks in export
**Solution**:
1. Verify your date range is correct
2. Check if tasks exist within that date range
3. Try removing other filters to see if they're conflicting
4. Check task start_date and end_date values in the system

## Date Format

All dates use the format: **YYYY-MM-DD**

Examples:
- January 1, 2026 → 2026-01-01
- May 31, 2026 → 2026-05-31
- December 25, 2026 → 2026-12-25

The date picker will automatically format your selection correctly.

## Support

For issues or questions about the date range filter:
1. Check this guide first
2. Verify your date format is correct
3. Try clearing filters and starting fresh
4. Contact your system administrator if problems persist
