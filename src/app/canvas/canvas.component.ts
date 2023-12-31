import { Component, ElementRef, OnInit, ViewChild, HostListener} from '@angular/core';

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.css']
})
export class CanvasComponent implements OnInit {
  @ViewChild('canvas') canvas!: ElementRef;

  private ctx!: CanvasRenderingContext2D;
  
  pointList: Point[] = [];
  numberOfPoints: number = 100;
  triangulation: [Point, Point, Point][] = [];
  voronoiDiagram: [Point, Point][] = [];

  constructor(
  ) { }

  public screenWidth!: number;
  public screenHeight!: number;
  public drawSceneWidth!: number;
  public drawSceneHeight!: number;
  
  @HostListener('window:resize', ['$event'])
  onResize() {
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
  }

  ngOnInit() {
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
    this.drawSceneWidth = window.innerWidth * 1.2;
    this.drawSceneHeight = window.innerHeight * 1.2;
  }

  ngAfterViewInit() {
    this.ctx = this.canvas.nativeElement.getContext('2d');
    this.initialize();
    window.requestAnimationFrame(this.update.bind(this));
  }

  initialize() {
    this.pointList = this.createRandomPointList(this.numberOfPoints);
    this.triangulation = this.bowyerWatson(this.pointList);
    this.voronoiDiagram = this.computeVoronoiDiagram(this.triangulation);
    console.log("Triangulation :");
    console.log(this.triangulation);
    console.log("VoronoiDigram");
    console.log(this.voronoiDiagram);
  }

  update() {
    this.clearCanvas();
    this.drawVertices(this.triangulation, this.ctx);
    this.drawTriangles(this.triangulation, this.ctx);
    this.drawSegment(this.voronoiDiagram, this.ctx);
    //this.drawCircumcircles(this.triangulation, this.ctx);
    window.requestAnimationFrame(this.update.bind(this));
  }
  
  clearCanvas() {
    this.ctx.clearRect(0, 0, this.screenWidth, this.screenHeight);
  }

  createRandomPointList(numberOfPoints: number): Point[] {
    let pointList: Point[] = [];
    for(let i = 0; i < numberOfPoints; i++){
        let x = Math.random() * this.screenWidth;
        let y = Math.random() * this.screenHeight;
        pointList.push(new Point(x, y));
    }
    return pointList;
  }

  computeVoronoiDiagram(triangulation: [Point, Point, Point][]): [Point, Point][] {
    //let centersOfCircumcircles: Point[] = this.getCircumcenters(triangulation);
    let diagram: [Point, Point][] = [];

    for (let triangle of triangulation) {
      for (let edge of this.extractEdges(triangle)) {
        for (let otherTriangle of this.removeFromList(triangulation, triangle)) {
          if (this.edgeIsSharedByOtherTriangles(edge, [otherTriangle])) {
            let centerOftriangleCircumcircle: Point = this.calculateCircumcircle(triangle[0], triangle[1], triangle[2]).center;
            let centerOfOtherTriangleCircumcircle: Point = this.calculateCircumcircle(otherTriangle[0], otherTriangle[1], otherTriangle[2]).center;

            let newSegment: [Point, Point] = [centerOftriangleCircumcircle, centerOfOtherTriangleCircumcircle];
            if (!diagram.some(segment => {
              return (newSegment[0] === segment[0] && newSegment[1] === segment[1]) ||
                     (newSegment[0] === segment[1] && newSegment[1] === segment[0]);
            })) {
              diagram.push(newSegment);
            }
          }
        }
      }
      triangulation = this.removeFromList(triangulation, triangle);
    }
    return diagram;
  }

  bowyerWatson(pointList: Point[]) {
    let triangulation: [Point, Point, Point][] = [];
    let st: [Point, Point, Point] = this.createSupraTriangle(this.screenWidth, this.screenHeight);
    triangulation.push(st);

    for (let point of pointList) {
      console.log(point);
      let badTriangles: [Point, Point, Point][] = [];
    
      for (let triangle of triangulation) {
        if (this.isInsideCircumcircle(point, triangle)) {
          badTriangles.push(triangle);
        }
      }
      // console.log("Bad Triangles");
      // console.log(badTriangles);

      let polygon: [Point, Point][] = [];
      for (let triangle of badTriangles) {
        let otherBadTriangles: [Point, Point, Point][] = this.removeFromList(badTriangles, triangle);
        for (let edge of this.extractEdges(triangle)) {
          if (!this.edgeIsSharedByOtherTriangles(edge, otherBadTriangles)) {
            polygon.push(edge);
          }
        }
      }
      // console.log("Polygon");
      // console.log(polygon);

      for (let triangle of badTriangles) {
        triangulation = this.removeFromList(triangulation, triangle);
      }
      for (let edge of polygon) {
        let newTriangle: [Point, Point, Point] = [point, edge[0], edge[1]];
        triangulation.push(newTriangle);
      }
    }
    for (let triangle of triangulation) {
      if (this.shareVertices(triangle, st)) {
        triangulation = this.removeFromList(triangulation, triangle);
      }
    }
    return triangulation;
  }

  calculateCircumcircle(p1: Point, p2: Point, p3: Point) {
    const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
  
    const ux = ((p1.x * p1.x + p1.y * p1.y) * (p2.y - p3.y) + (p2.x * p2.x + p2.y * p2.y) * (p3.y - p1.y) + (p3.x * p3.x + p3.y * p3.y) * (p1.y - p2.y)) / d;
    const uy = ((p1.x * p1.x + p1.y * p1.y) * (p3.x - p2.x) + (p2.x * p2.x + p2.y * p2.y) * (p1.x - p3.x) + (p3.x * p3.x + p3.y * p3.y) * (p2.x - p1.x)) / d;
  
    const center = new Point(ux, uy);
    const radius = Math.sqrt(Math.pow(p1.x - ux, 2) + Math.pow(p1.y - uy, 2));
  
    return {center, radius};
  }

  isInsideCircumcircle(point: Point, triangle: [Point, Point, Point]): boolean {
    if (triangle.length !== 3) {
      throw new Error("Triangle should have exactly 3 points");
    }

    let circumcircle = this.calculateCircumcircle(triangle[0], triangle[1], triangle[2]);
    //console.log(circumcircle);

    let dx = circumcircle.center.x - point.x;
    let dy = circumcircle.center.y - point.y;
    let distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= circumcircle.radius;
  }

  createSupraTriangle(w: number, h: number): [Point, Point, Point] {
    let b: number = h / Math.sqrt(3);
    let t:number = w * Math.sqrt(3) / 2;
    let p1: Point = new Point(-b, 0);
    let p2: Point = new Point(w + b, 0);
    let p3: Point = new Point(w / 2, h + t);

    return [p1, p2, p3];
  }

  extractEdges(triangle: Point[]): [Point, Point][] {
    if (triangle.length !== 3) {
      throw new Error("Triangle should have exactly 3 points");
    }
  
    return [
      [triangle[0], triangle[1]],
      [triangle[1], triangle[2]],
      [triangle[2], triangle[0]]
    ];
  }

  edgeIsSharedByOtherTriangles(edge: [Point, Point], listOfTriangles: [Point, Point, Point][]): boolean {
    const edgeSet = new Set([edge[0], edge[1]]);
  
    return listOfTriangles.some(triangle => {
      const triangleSet = new Set(triangle);
      // Check if both edge points are in the triangle
      return Array.from(edgeSet).every(point => triangleSet.has(point));
    });
  }

  removeFromList(triangleList: [Point, Point, Point][], triangle: Point[]) {
    return triangleList.filter(item => item !== triangle);
  }

  shareVertices(t1: [Point, Point, Point], t2: [Point, Point, Point]) {
    return t1.some(p1 => t2.some(p2 => p1.x === p2.x && p1.y === p2.y));
  }

  drawTriangles(triangulation: [Point, Point, Point][], context: CanvasRenderingContext2D): void {
    for(let triangle of triangulation) {
      context.beginPath();
      context.moveTo(triangle[0].x, triangle[0].y);
      context.lineTo(triangle[1].x, triangle[1].y);
      context.lineTo(triangle[2].x, triangle[2].y);
      context.closePath();
      context.stroke();
    }
  }

  drawVertices(triangulation: [Point, Point, Point][], context: CanvasRenderingContext2D, radius: number = 3): void {
    for(let triangle of triangulation) {
      for(let point of triangle) {
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
        context.fill();
      }
    }
  }

  drawSegment(diagram: [Point, Point][], context: CanvasRenderingContext2D): void {
    for(let segment of diagram) {
        context.beginPath();
        context.moveTo(segment[0].x, segment[0].y);
        context.lineTo(segment[1].x, segment[1].y);
        context.strokeStyle = 'blue';
        context.stroke();
        context.strokeStyle = 'black';
    }
  }

  drawCircumcircles(triangulation: [Point, Point, Point][], context: CanvasRenderingContext2D): void {
    context.strokeStyle = 'red';  // Setting the stroke color to red

    for(let triangle of triangulation) {
        // Calculate the circumcircle of the current triangle
        let circumcircle = this.calculateCircumcircle(triangle[0], triangle[1], triangle[2]);

        context.beginPath();
        // Draw the circle using the center point and radius of the circumcircle
        context.arc(circumcircle.center.x, circumcircle.center.y, circumcircle.radius, 0, 2 * Math.PI);
        context.stroke();
        
        // Draw the center of the circumcircle
        context.fillStyle = 'red '; // Setting fill color to blue for the center point
        context.beginPath();
        context.arc(circumcircle.center.x, circumcircle.center.y, 3, 0, 2 * Math.PI);  // Radius of 3 for the center point
        context.fill();
    }
    context.strokeStyle = 'black';
    context.fillStyle = 'black';
  }

}

export class Point {

  constructor(public x: number, 
              public y: number){}

}
