import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  Type, 
  Calendar, 
  FileSignature, 
  Square, 
  Save, 
  X, 
  Settings,
  Move,
  Trash2,
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  EyeOff,
  Layers,
  Grid,
  Smartphone,
  Monitor,
  Tablet,
  Palette,
  Lock,
  Unlock,
  Copy
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EnhancedPDFViewer } from "./EnhancedPDFViewer";
import "@/lib/pdf-config";

interface TemplateField {
  id?: string;
  field_name: string;
  field_type: "text" | "date" | "signature" | "checkbox";
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  page_number: number;
  is_required: boolean;
  placeholder_text?: string;
  properties?: any;
}

interface FieldDesignerProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  templateUrl: string;
}

export function FieldDesigner({ isOpen, onClose, templateId, templateUrl }: FieldDesignerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedField, setSelectedField] = useState<TemplateField | null>(null);
  const [isCreatingField, setIsCreatingField] = useState(false);
  const [newFieldType, setNewFieldType] = useState<TemplateField["field_type"]>("text");
  const [showGrid, setShowGrid] = useState(true);
  const [fieldsVisible, setFieldsVisible] = useState(true);
  const [viewMode, setViewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [isLocked, setIsLocked] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch existing fields
  const { data: existingFields } = useQuery({
    queryKey: ["template-fields", templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("template_fields")
        .select("*")
        .eq("template_id", templateId)
        .order("page_number");
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen
  });

  useEffect(() => {
    if (existingFields) {
      setFields(existingFields.map(field => ({
        id: field.id,
        field_name: field.field_name,
        field_type: field.field_type as TemplateField["field_type"],
        x_position: field.x_position,
        y_position: field.y_position,
        width: field.width,
        height: field.height,
        page_number: field.page_number,
        is_required: field.is_required,
        placeholder_text: field.placeholder_text,
        properties: field.properties
      })));
    }
  }, [existingFields]);

  // Save fields mutation
  const saveFieldsMutation = useMutation({
    mutationFn: async (fieldsToSave: TemplateField[]) => {
      await supabase
        .from("template_fields")
        .delete()
        .eq("template_id", templateId);

      const { error } = await supabase
        .from("template_fields")
        .insert(
          fieldsToSave.map(field => ({
            template_id: templateId,
            field_name: field.field_name,
            field_type: field.field_type,
            x_position: field.x_position,
            y_position: field.y_position,
            width: field.width,
            height: field.height,
            page_number: field.page_number,
            is_required: field.is_required,
            placeholder_text: field.placeholder_text,
            properties: field.properties
          }))
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template-fields", templateId] });
      toast.success("Fields saved successfully");
    },
    onError: (error) => {
      toast.error("Failed to save fields: " + error.message);
    }
  });

  const handlePageClick = (event: React.MouseEvent) => {
    if (!isCreatingField || isLocked) return;

    const pageElement = event.currentTarget.querySelector('.react-pdf__Page');
    if (!pageElement) return;
    
    const rect = pageElement.getBoundingClientRect();
    const effectiveScale = scale * getViewModeScale();
    const x = (event.clientX - rect.left) / effectiveScale;
    const y = (event.clientY - rect.top) / effectiveScale;

    const newField: TemplateField = {
      field_name: `${newFieldType}_field_${Date.now()}`,
      field_type: newFieldType,
      x_position: Math.max(0, x),
      y_position: Math.max(0, y),
      width: getDefaultFieldSize(newFieldType).width,
      height: getDefaultFieldSize(newFieldType).height,
      page_number: currentPage,
      is_required: true,
      placeholder_text: getDefaultPlaceholder(newFieldType)
    };

    setFields([...fields, newField]);
    setSelectedField(newField);
    setIsCreatingField(false);
    toast.success(`${newFieldType} field added`);
  };

  const getDefaultFieldSize = (type: TemplateField["field_type"]) => {
    const sizes = {
      text: { width: 120, height: 32 },
      date: { width: 120, height: 32 },
      signature: { width: 180, height: 60 },
      checkbox: { width: 24, height: 24 }
    };
    return sizes[type];
  };

  const getDefaultPlaceholder = (type: TemplateField["field_type"]) => {
    const placeholders = {
      text: "Enter text here",
      date: "Select date",
      signature: "Sign here",
      checkbox: ""
    };
    return placeholders[type];
  };

  const handleFieldDrag = (fieldIndex: number, event: React.MouseEvent) => {
    if (isLocked) return;
    
    event.preventDefault();
    const field = fields[fieldIndex];
    if (!field) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const initialX = field.x_position;
    const initialY = field.y_position;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const effectiveScale = scale * getViewModeScale();
      const deltaX = (moveEvent.clientX - startX) / effectiveScale;
      const deltaY = (moveEvent.clientY - startY) / effectiveScale;

      const newX = Math.max(0, initialX + deltaX);
      const newY = Math.max(0, initialY + deltaY);

      setFields(prev => prev.map((f, i) => 
        i === fieldIndex 
          ? { ...f, x_position: newX, y_position: newY }
          : f
      ));

      if (selectedField === field) {
        setSelectedField({ ...field, x_position: newX, y_position: newY });
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const duplicateField = (field: TemplateField) => {
    const newField: TemplateField = {
      ...field,
      id: undefined,
      field_name: `${field.field_name}_copy`,
      x_position: field.x_position + 20,
      y_position: field.y_position + 20
    };
    setFields([...fields, newField]);
    setSelectedField(newField);
    toast.success("Field duplicated");
  };

  const deleteSelectedFields = () => {
    if (selectedField) {
      setFields(fields.filter(f => f !== selectedField));
      setSelectedField(null);
      toast.success("Field deleted");
    }
  };

  const fieldIcons = {
    text: Type,
    date: Calendar,
    signature: FileSignature,
    checkbox: Square
  };

  const fieldColors = {
    text: "bg-blue-500",
    date: "bg-green-500", 
    signature: "bg-purple-500",
    checkbox: "bg-orange-500"
  };

  const viewModeIcons = {
    desktop: Monitor,
    tablet: Tablet,
    mobile: Smartphone
  };

  const getViewModeScale = () => {
    const scales = {
      desktop: 1.0,
      tablet: 0.8,
      mobile: 0.6
    };
    return scales[viewMode];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] h-screen w-screen p-0 bg-gradient-to-br from-background via-background to-muted/20">
        {/* Top Navigation Bar */}
        <div className="bg-card/80 backdrop-blur-sm border-b border-border/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Field Designer</h2>
                <p className="text-sm text-muted-foreground">Design your document fields</p>
              </div>
            </div>
            
            <Separator orientation="vertical" className="h-8" />
            
            {/* Field Statistics */}
            <div className="hidden md:flex items-center gap-4">
              <Badge variant="outline" className="bg-muted/50">
                {fields.length} fields
              </Badge>
              <Badge variant="outline" className="bg-muted/50">
                Page {currentPage}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="hidden md:flex bg-muted/50 rounded-lg p-1">
              {Object.entries(viewModeIcons).map(([mode, Icon]) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode(mode as typeof viewMode)}
                  className="h-8 px-3"
                >
                  <Icon className="w-4 h-4" />
                </Button>
              ))}
            </div>

            <Separator orientation="vertical" className="h-8 hidden md:block" />

            {/* Action Buttons */}
            <Button
              onClick={() => saveFieldsMutation.mutate(fields)}
              disabled={saveFieldsMutation.isPending}
              size="sm"
              className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Fields
            </Button>
            
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop Sidebar */}
          <div className="hidden lg:flex w-80 flex-col bg-card/50 border-r border-border/50 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Field Tools */}
              <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      Field Types
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {isCreatingField ? "Placing..." : "Ready"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(fieldIcons).map(([type, Icon]) => (
                    <Button
                      key={type}
                      variant={newFieldType === type && isCreatingField ? "default" : "outline"}
                      size="sm"
                      className="w-full justify-start group hover:scale-105 transition-all duration-200"
                      onClick={() => {
                        setNewFieldType(type as TemplateField["field_type"]);
                        setIsCreatingField(true);
                        toast.info(`Click on the document to place a ${type} field`);
                      }}
                    >
                      <div className={`w-3 h-3 rounded-full ${fieldColors[type as keyof typeof fieldColors]} mr-3 group-hover:scale-110 transition-transform`} />
                      <Icon className="w-4 h-4 mr-2" />
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Button>
                  ))}
                </CardContent>
              </Card>

              {/* Canvas Controls */}
              <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Canvas Controls
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Show Grid</Label>
                    <Switch
                      checked={showGrid}
                      onCheckedChange={setShowGrid}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Show Fields</Label>
                    <Switch
                      checked={fieldsVisible}
                      onCheckedChange={setFieldsVisible}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Lock Fields</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsLocked(!isLocked)}
                      className="h-8 w-8 p-0"
                    >
                      {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-sm">Zoom Level</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setScale(Math.max(0.25, scale - 0.25))}
                        className="h-8 w-8 p-0"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                      <Badge variant="outline" className="flex-1 justify-center">
                        {Math.round(scale * 100)}%
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setScale(Math.min(3, scale + 0.25))}
                        className="h-8 w-8 p-0"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Selected Field Properties */}
              {selectedField && (
                <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Field Properties
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => duplicateField(selectedField)}
                          className="h-8 w-8 p-0"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={deleteSelectedFields}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="fieldName" className="text-sm">Field Name</Label>
                      <Input
                        id="fieldName"
                        value={selectedField.field_name}
                        onChange={(e) => {
                          const updated = { ...selectedField, field_name: e.target.value };
                          setSelectedField(updated);
                          setFields(fields.map(f => f === selectedField ? updated : f));
                        }}
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="fieldType" className="text-sm">Field Type</Label>
                      <Select
                        value={selectedField.field_type}
                        onValueChange={(value: TemplateField["field_type"]) => {
                          const updated = { ...selectedField, field_type: value };
                          setSelectedField(updated);
                          setFields(fields.map(f => f === selectedField ? updated : f));
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="signature">Signature</SelectItem>
                          <SelectItem value="checkbox">Checkbox</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedField.field_type !== "checkbox" && (
                      <div>
                        <Label htmlFor="placeholder" className="text-sm">Placeholder Text</Label>
                        <Input
                          id="placeholder"
                          value={selectedField.placeholder_text || ""}
                          onChange={(e) => {
                            const updated = { ...selectedField, placeholder_text: e.target.value };
                            setSelectedField(updated);
                            setFields(fields.map(f => f === selectedField ? updated : f));
                          }}
                          className="mt-1"
                        />
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="required"
                        checked={selectedField.is_required}
                        onCheckedChange={(checked) => {
                          const updated = { ...selectedField, is_required: checked };
                          setSelectedField(updated);
                          setFields(fields.map(f => f === selectedField ? updated : f));
                        }}
                      />
                      <Label htmlFor="required" className="text-sm">Required Field</Label>
                    </div>

                    <Separator />

                    {/* Position and Size */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">X Position</Label>
                        <Badge variant="outline" className="w-full justify-center">
                          {Math.round(selectedField.x_position)}px
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Y Position</Label>
                        <Badge variant="outline" className="w-full justify-center">
                          {Math.round(selectedField.y_position)}px
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Width</Label>
                        <Badge variant="outline" className="w-full justify-center">
                          {Math.round(selectedField.width)}px
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Height</Label>
                        <Badge variant="outline" className="w-full justify-center">
                          {Math.round(selectedField.height)}px
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 flex flex-col relative">
            {/* Mobile Floating Action Button */}
            <div className="lg:hidden fixed bottom-6 right-6 z-50">
              <Sheet>
                <SheetTrigger asChild>
                  <Button 
                    size="lg" 
                    className="rounded-full shadow-lg bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary h-14 w-14"
                  >
                    <Plus className="w-6 h-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <SheetHeader>
                    <SheetTitle>Field Tools</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-6">
                    {/* Mobile Field Types */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">Add Fields</h4>
                      {Object.entries(fieldIcons).map(([type, Icon]) => (
                        <Button
                          key={type}
                          variant={newFieldType === type && isCreatingField ? "default" : "outline"}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            setNewFieldType(type as TemplateField["field_type"]);
                            setIsCreatingField(true);
                            toast.info(`Tap on the document to place a ${type} field`);
                          }}
                        >
                          <div className={`w-3 h-3 rounded-full ${fieldColors[type as keyof typeof fieldColors]} mr-3`} />
                          <Icon className="w-4 h-4 mr-2" />
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Button>
                      ))}
                    </div>

                    {/* Mobile Field Properties */}
                    {selectedField && (
                      <div className="space-y-4 pt-4 border-t">
                        <h4 className="font-medium text-sm">Selected Field</h4>
                        <div>
                          <Label htmlFor="mobile-fieldName" className="text-sm">Field Name</Label>
                          <Input
                            id="mobile-fieldName"
                            value={selectedField.field_name}
                            onChange={(e) => {
                              const updated = { ...selectedField, field_name: e.target.value };
                              setSelectedField(updated);
                              setFields(fields.map(f => f === selectedField ? updated : f));
                            }}
                            className="mt-1"
                          />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="mobile-required"
                            checked={selectedField.is_required}
                            onCheckedChange={(checked) => {
                              const updated = { ...selectedField, is_required: checked };
                              setSelectedField(updated);
                              setFields(fields.map(f => f === selectedField ? updated : f));
                            }}
                          />
                          <Label htmlFor="mobile-required" className="text-sm">Required</Label>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => duplicateField(selectedField)}
                            className="flex-1"
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={deleteSelectedFields}
                            className="flex-1"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 relative bg-gradient-to-br from-muted/10 to-muted/30 overflow-hidden">
              {showGrid && (
                <div 
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                      linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px'
                  }}
                />
              )}

              {fieldsVisible && (
                <EnhancedPDFViewer
                  pdfUrl={templateUrl}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  scale={scale * getViewModeScale()}
                  onScaleChange={setScale}
                  onPageClick={handlePageClick}
                  className="h-full"
                  overlayContent={
                    <>
                      {fields
                        .filter(field => field.page_number === currentPage)
                        .map((field, index) => {
                          const Icon = fieldIcons[field.field_type];
                          const fieldIndex = fields.findIndex(f => f === field);
                          const effectiveScale = scale * getViewModeScale();
                          
                          return (
                            <div
                              key={field.id || index}
                              className={`absolute border-2 rounded-lg flex items-center justify-center select-none transition-all duration-200 ${
                                selectedField === field 
                                  ? "border-primary bg-primary/20 shadow-lg ring-2 ring-primary/20" 
                                  : "border-primary/40 bg-primary/10 hover:border-primary/60 hover:bg-primary/15"
                              } ${
                                isCreatingField ? "cursor-crosshair" : isLocked ? "cursor-not-allowed" : "cursor-move"
                              } ${
                                field.field_type === "signature" ? "bg-gradient-to-br from-purple-100 to-purple-200 border-purple-300" :
                                field.field_type === "text" ? "bg-gradient-to-br from-blue-100 to-blue-200 border-blue-300" :
                                field.field_type === "date" ? "bg-gradient-to-br from-green-100 to-green-200 border-green-300" :
                                "bg-gradient-to-br from-orange-100 to-orange-200 border-orange-300"
                              }`}
                              style={{
                                left: field.x_position * effectiveScale,
                                top: field.y_position * effectiveScale,
                                width: field.width * effectiveScale,
                                height: field.height * effectiveScale,
                                zIndex: selectedField === field ? 30 : 20
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setSelectedField(field);
                                if (!isCreatingField && !isLocked) {
                                  handleFieldDrag(fieldIndex, e);
                                }
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                setSelectedField(field);
                              }}
                              title={`${field.field_name}${field.is_required ? ' (Required)' : ''} - ${isLocked ? 'Locked' : 'Drag to move'}`}
                            >
                              <Icon className={`w-4 h-4 pointer-events-none ${
                                field.field_type === "signature" ? "text-purple-600" :
                                field.field_type === "text" ? "text-blue-600" :
                                field.field_type === "date" ? "text-green-600" :
                                "text-orange-600"
                              }`} />
                              
                              {field.width * effectiveScale > 80 && (
                                <span className={`text-xs ml-1 truncate pointer-events-none font-medium ${
                                  field.field_type === "signature" ? "text-purple-700" :
                                  field.field_type === "text" ? "text-blue-700" :
                                  field.field_type === "date" ? "text-green-700" :
                                  "text-orange-700"
                                }`}>
                                  {field.field_name}
                                </span>
                              )}
                              
                              {field.is_required && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white" />
                              )}

                              {/* Selection Indicators */}
                              {selectedField === field && !isCreatingField && !isLocked && (
                                <>
                                  {/* Corner Resize Handles */}
                                  <div className="absolute -top-1 -left-1 w-3 h-3 bg-primary border border-white rounded-full" />
                                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary border border-white rounded-full" />
                                  <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-primary border border-white rounded-full" />
                                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary border border-white rounded-full cursor-se-resize" />
                                </>
                              )}
                            </div>
                          );
                        })}
                    </>
                  }
                />
              )}

              {/* Status Overlay */}
              {isCreatingField && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40">
                  <Card className="bg-primary/90 text-primary-foreground border-primary">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        <span className="text-sm font-medium">
                          {viewMode === "mobile" ? "Tap" : "Click"} to place {newFieldType} field
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {isLocked && (
                <div className="absolute top-4 right-4 z-40">
                  <Badge className="bg-amber-500 text-amber-50">
                    <Lock className="w-3 h-3 mr-1" />
                    Locked
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}